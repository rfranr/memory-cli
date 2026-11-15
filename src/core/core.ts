import { Observability, type TraceFilter } from '../infrastructure/database/observability.js';
import { Memories } from '../application/memories.js';
import { existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { documentIdentity } from '../application/read-input.js';
import { FindDocumentsUseCase } from '../application/find-documents.js';
import { IndexDocumentUseCase } from '../application/index-document.js';
import { SearchDocumentsUseCase } from '../application/search-documents.js';
import { StatsUseCase } from '../application/stats.js';
import { buildConfig, type AppConfig, type ConfigOptions } from '../config/config.js';
import type { FindCommand, IndexDocumentCommand, SearchCommand } from '../domain/commands.js';
import type { AppStats, FindResult, IndexDocumentResult, SearchMatch } from '../domain/entities.js';
import { SqliteVectorStore } from '../infrastructure/database/sqlite-vector-store.js';
import { HttpEmbeddingClient } from '../infrastructure/embedding/http-embedding-client.js';
import { createStderrProgressReporter } from '../shared/progress.js';

export class RagCliApp {
  constructor(private readonly config: AppConfig) {}

  traces(filter: TraceFilter = {}) {
    return new Observability(this.config.databasePath).traces(filter);
  }
  cleanupTraces(before: string) {
    return new Observability(this.config.databasePath).cleanup(before);
  }
  async dashboard(project?: string) {
    await this.stats();

    return new Observability(this.config.databasePath).inventory(project);
  }
  indexDocument(command: IndexDocumentCommand) {
    if (command.dryRun) {
      return this.indexDocumentImpl(command);
    }

    return this.observe('index', String(command.metadata.project ?? '') || undefined, () =>
      this.indexDocumentImpl(command),
    );
  }
  async forget(source: string) {
    let context: { count?: number; project?: string } = {};

    try {
      context = await new Observability(this.config.databasePath).sourceContext(documentIdentity(source));
    } catch {
      /* Context lookup cannot prevent deletion. */
    }

    return this.observe('forget --source', context.project, () => this.forgetImpl(source), context);
  }
  search(command: SearchCommand) {
    return this.observe('search', command.project, () => this.searchImpl(command));
  }
  remember(content: string, project: string, scope: string) {
    return this.observe('remember', project, () => this.rememberImpl(content, project, scope));
  }
  async memoryUpdate(id: string, content: string) {
    return this.observeMemory('memories update', id, () => this.memoryUpdateImpl(id, content));
  }
  async memoryForget(id: string) {
    return this.observeMemory('memories forget', id, () => this.memoryForgetImpl(id));
  }
  private async observeMemory(operation: string, id: string, action: () => Promise<unknown>) {
    let project: string | undefined;

    try {
      project = ((await this.memoryGet(id)) as { project: string }).project;
    } catch {
      /* Primary operation reports failure. */
    }

    return this.observe(operation, project, action, { ids: [id] });
  }
  private async observe<T>(
    operation: string,
    project: string | undefined,
    action: () => Promise<T>,
    context: { ids?: string[]; count?: number } = {},
  ): Promise<T> {
    const start = performance.now();
    let status = 'failure';
    let result: T | undefined;

    try {
      result = await action();
      status = 'success';

      return result;
    } finally {
      const rows = Array.isArray(result) ? result : [result];
      const memoryIds = rows.flatMap((row) => {
        const value = row as { id?: unknown; metadata?: { memoryId?: string } } | undefined;
        const id = value?.metadata?.memoryId ?? (typeof value?.id === 'string' ? value.id : undefined);

        return id ? [id] : [];
      });

      try {
        await new Observability(this.config.databasePath).record({
          timestamp: new Date().toISOString(),
          operation,
          status,
          project: project ?? null,
          actor: process.env.MEMORY_CLI_ACTOR || 'unknown',
          session: process.env.MEMORY_CLI_SESSION || null,
          durationMs: performance.now() - start,
          count: status === 'failure' ? 0 : (context.count ?? traceCount(status, operation, result)),
          memoryIds: [...new Set([...(context.ids ?? []), ...memoryIds])].filter(isMemoryId),
        });
      } catch {
        /* Telemetry must never change the primary result. */
      }
    }
  }

  private async indexDocumentImpl(command: IndexDocumentCommand): Promise<IndexDocumentResult> {
    if (existsSync(command.input) && statSync(command.input).isDirectory()) {
      const results: IndexDocumentResult[] = [];

      for (const name of (await readdir(command.input)).sort()) {
        results.push(await this.indexDocumentImpl({ ...command, input: join(command.input, name) }));
      }

      return {
        chunks: results.reduce((sum, result) => sum + result.chunks, 0),
        ids: results.flatMap((result) => result.ids),
        results,
      };
    }
    const store = this.vectorStore();

    try {
      if (!command.dryRun || existsSync(this.config.databasePath)) {
        await store.init();
      }

      return await new IndexDocumentUseCase(this.embeddings(), store).execute(
        command,
        createStderrProgressReporter('Indexing chunks'),
      );
    } finally {
      await store.close();
    }
  }

  private async forgetImpl(source: string): Promise<{ forgotten: true; identity: string }> {
    const identity = documentIdentity(source);
    const store = this.vectorStore();

    try {
      await store.init();
      await store.forgetDocument(identity);

      return { forgotten: true, identity };
    } finally {
      await store.close();
    }
  }

  async stats(): Promise<AppStats & { observability?: unknown }> {
    const store = this.vectorStore();

    try {
      await store.init();

      const stats = await new StatsUseCase(store, this.config.databasePath).execute();

      return { ...stats, observability: await new Observability(this.config.databasePath).inventory() };
    } finally {
      await store.close();
    }
  }

  async find(command: FindCommand): Promise<FindResult> {
    const store = this.vectorStore();

    try {
      await store.init();

      return await new FindDocumentsUseCase(store).execute(command);
    } finally {
      await store.close();
    }
  }

  private async searchImpl(command: SearchCommand): Promise<SearchMatch[]> {
    const store = this.vectorStore();

    try {
      await store.init();

      return await new SearchDocumentsUseCase(this.embeddings(), store).execute(command);
    } finally {
      await store.close();
    }
  }

  private async rememberImpl(content: string, project: string, scope: string): Promise<unknown> {
    return this.withMemories((memories) => memories.remember(content, project, scope));
  }

  async memoryGet(id: string): Promise<unknown> {
    return this.withMemories((memories) => memories.get(id));
  }

  async memoryList(project: string): Promise<unknown> {
    return this.withMemories((memories) => memories.list(project));
  }

  private async memoryUpdateImpl(id: string, content: string): Promise<unknown> {
    return this.withMemories((memories) => memories.update(id, content));
  }

  private async memoryForgetImpl(id: string): Promise<unknown> {
    return this.withMemories((memories) => memories.forget(id));
  }

  private async withMemories<T>(action: (memories: Memories) => Promise<T>): Promise<T> {
    const store = this.vectorStore();

    try {
      await store.init();

      return await action(new Memories(store, this.embeddings()));
    } finally {
      await store.close();
    }
  }

  private embeddings(): HttpEmbeddingClient {
    return new HttpEmbeddingClient(
      this.config.embeddingEndpoint,
      this.config.embeddingProvider,
      this.config.embeddingModel,
    );
  }

  private vectorStore(): SqliteVectorStore {
    return new SqliteVectorStore(this.config.databasePath, {
      embedding_provider: this.config.embeddingProvider,
      embedding_url: this.config.embeddingEndpoint,
      embedding_model: this.config.embeddingModel,
      embedding_dimensions: String(this.config.embeddingDimensions),
    });
  }
}

export function createApp(options: ConfigOptions): RagCliApp {
  return new RagCliApp(buildConfig(options));
}

function operationCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === 'object' && 'chunks' in value) {
    return Number(value.chunks);
  }

  return value ? 1 : 0;
}

function traceCount(status: string, operation: string, result: unknown): number | null {
  if (status === 'failure') {
    return 0;
  }
  if (operation === 'forget --source') {
    return null;
  }

  return operationCount(result);
}

function isMemoryId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
