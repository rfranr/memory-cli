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
    const content = await readInput(command.input);
    const identity = documentIdentity(command.input);
    const hash = createHash('sha256').update(content).digest('hex');

    if (!command.dryRun && (await this.store.isDocumentCurrent(identity, hash))) {
      return { chunks: 0, ids: [] };
    }

    const chunks = chunkText(content);

    if (chunks.length === 0) {
      throw new Error('Cannot index document: input did not contain any non-empty chunks');
    }

    progress.start(chunks.length);

    const chunksToInsert: DocumentChunk[] = [];

    let processed = 0;

    for (const chunk of chunks) {
      const chunkEmbedding = await this.embeddings.embed(chunk.content);

      chunksToInsert.push({
        source: command.input,
        content: chunk.content,
        embedding: chunkEmbedding,
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
    }

    if (command.dryRun) {
      progress.done(chunks.length);

      return { dryRun: true, chunks: chunks.length, ids: [], documents: chunksToInsert };
    }

    const ids = await this.store.replaceDocument(identity, hash, chunksToInsert);

    progress.done(chunks.length);

    return {
      chunks: chunks.length,
      ids,
    };
  }
}
