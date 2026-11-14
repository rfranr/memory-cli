import { createHash } from 'node:crypto';
import type { IndexDocumentCommand } from '../domain/commands.js';
import type { DocumentChunk, IndexDocumentResult } from '../domain/entities.js';
import type { EmbeddingClient, VectorStore } from '../domain/ports.js';
import { noopProgressReporter, type ProgressReporter } from '../shared/progress.js';
import { chunkText } from '../shared/chunk-text.js';
import { documentIdentity, readInput } from './read-input.js';

export class IndexDocumentUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly store: VectorStore,
  ) {}

  async execute(
    command: IndexDocumentCommand,
    progress: ProgressReporter = noopProgressReporter,
  ): Promise<IndexDocumentResult> {
    const identity = documentIdentity(command.input);

    if (await this.store.isDocumentForgotten?.(identity)) {
      return { chunks: 0, ids: [], skipped: 'forgotten', identity };
    }

    const content = await readInput(command.input);
    const hash = createHash('sha256').update(content).digest('hex');

    if (await this.isCurrent(command, identity, hash)) {
      return { chunks: 0, ids: [] };
    }

    const chunks = chunkText(content);

    if (chunks.length === 0) {
      throw new Error('Cannot index document: input did not contain any non-empty chunks');
    }

    progress.start(chunks.length);

    const chunksToInsert: DocumentChunk[] = [];

    let processed = 0;

    for (let offset = 0; offset < chunks.length; offset += 8) {
      const batch = chunks.slice(offset, offset + 8);
      const vectors = await embedBatch(
        this.embeddings,
        batch.map((chunk) => chunk.content),
      );

      batch.forEach((chunk, index) => {
        chunksToInsert.push({
          source: command.input,
          content: chunk.content,
          embedding: vectors[index],
          metadata: {
            ...command.metadata,
            chunkIndex: chunk.chunkIndex,
            chunkCount: chunk.chunkCount,
            chunkStart: chunk.chunkStart,
            chunkEnd: chunk.chunkEnd,
          },
        });

        processed += 1;
        progress.update(processed, chunks.length);
      });
    }

    if (command.dryRun) {
      progress.done(chunks.length);

      return { dryRun: true, chunks: chunks.length, ids: [], documents: chunksToInsert };
    }

    const ids = await this.store.replaceDocument(identity, hash, chunksToInsert);

    progress.done(chunks.length);

    return indexResult(ids, identity);
  }

  private async isCurrent(command: IndexDocumentCommand, identity: string, hash: string): Promise<boolean> {
    return !command.dryRun && this.store.isDocumentCurrent(identity, hash);
  }
}

function indexResult(ids: number[], identity: string): IndexDocumentResult {
  return ids.length === 0 ? { chunks: 0, ids, skipped: 'forgotten', identity } : { chunks: ids.length, ids };
}

async function embedBatch(client: EmbeddingClient, inputs: string[]): Promise<number[][]> {
  const vectors: number[][] = [];

  if (client.embedMany) {
    vectors.push(...(await client.embedMany(inputs)));
  } else {
    for (const input of inputs) {
      vectors.push(await client.embed(input));
    }
  }
  if (vectors.length !== inputs.length || !vectors.every(isValidVector)) {
    throw new Error('Invalid embedding batch: expected one non-empty finite vector per input');
  }

  return vectors;
}

function isValidVector(vector: number[]): boolean {
  return Array.isArray(vector) && vector.length > 0 && vector.every(Number.isFinite);
}
