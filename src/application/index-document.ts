import type { IndexDocumentCommand } from "../domain/commands.js";
import type { IndexDocumentResult } from "../domain/entities.js";
import type { CategoryStore, EmbeddingClient, VectorStore } from "../domain/ports.js";
import { chunkText } from "../shared/chunk-text.js";
import { readInput } from "./classify-document.js";

export class IndexDocumentUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly store: VectorStore,
    private readonly categories: CategoryStore,
  ) {}

  async execute(command: IndexDocumentCommand): Promise<IndexDocumentResult> {
    const content = await readInput(command.input);
    const chunks = chunkText(content);

    if (chunks.length === 0) {
      throw new Error("Cannot index document: input did not contain any non-empty chunks");
    }

    const ids: number[] = [];

    for (const chunk of chunks) {
      const chunkEmbedding = await this.embeddings.embed(chunk.content);
      const [bestMatch] = await this.categories.search(chunkEmbedding, 1);

      if (!bestMatch) {
        throw new Error("Cannot index document: categories database is empty. Run `rag-cli categories sync <categories.yml>` first.");
      }

      ids.push(
        await this.store.add({
          source: command.input,
          content: chunk.content,
          embedding: chunkEmbedding,
          taxonomy: {
            category: bestMatch.category.id,
            taxonomy: bestMatch.category.path,
            description: bestMatch.category.description,
            metadata: {
              ...command.metadata,
              chunkIndex: chunk.chunkIndex,
              chunkCount: chunk.chunkCount,
              chunkStart: chunk.chunkStart,
              chunkEnd: chunk.chunkEnd,
              categoryScore: bestMatch.score,
            },
          },
        }),
      );
    }

    return {
      chunks: chunks.length,
      ids,
    };
  }
}
