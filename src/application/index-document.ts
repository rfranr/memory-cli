import type { IndexDocumentCommand } from "../domain/commands.js";
import type { CategoryStore, EmbeddingClient, VectorStore } from "../domain/ports.js";
import { readInput } from "./classify-document.js";

export class IndexDocumentUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly store: VectorStore,
    private readonly categories: CategoryStore,
  ) {}

  async execute(command: IndexDocumentCommand): Promise<number> {
    const content = await readInput(command.input);
    const contentEmbedding = await this.embeddings.embed(content);
    const [bestMatch] = await this.categories.search(contentEmbedding, 1);

    if (!bestMatch) {
      throw new Error("Cannot index document: categories database is empty. Run `rag-cli categories sync <categories.yml>` first.");
    }

    return this.store.add({
      source: command.input,
      content,
      embedding: contentEmbedding,
      taxonomy: {
        category: bestMatch.category.id,
        taxonomy: bestMatch.category.path,
        description: bestMatch.category.description,
        metadata: {
          ...command.metadata,
          categoryScore: bestMatch.score,
        },
      },
    });
  }
}
