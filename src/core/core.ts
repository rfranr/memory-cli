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

  async indexDocument(command: IndexDocumentCommand): Promise<IndexDocumentResult> {
    if (existsSync(command.input) && statSync(command.input).isDirectory()) {
      const results: IndexDocumentResult[] = [];

      for (const name of (await readdir(command.input)).sort()) {
        results.push(await this.indexDocument({ ...command, input: join(command.input, name) }));
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

  async forget(source: string): Promise<{ forgotten: true; identity: string }> {
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

  async stats(): Promise<AppStats> {
    const store = this.vectorStore();

    try {
      await store.init();

      return await new StatsUseCase(store, this.config.databasePath).execute();
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

  async search(command: SearchCommand): Promise<SearchMatch[]> {
    const store = this.vectorStore();

    try {
      await store.init();

      return await new SearchDocumentsUseCase(this.embeddings(), store).execute(command);
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
