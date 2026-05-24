import type { SearchCommand } from "../domain/commands.js";
import type { SearchMatch } from "../domain/entities.js";
import type { EmbeddingClient, VectorStore } from "../domain/ports.js";

export class SearchDocumentsUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly store: VectorStore,
  ) {}

  async execute(command: SearchCommand): Promise<SearchMatch[]> {
    const embedding = await this.embeddings.embed(command.text);
    return this.store.search(embedding, command.limit);
  }
}
