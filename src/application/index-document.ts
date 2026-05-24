import { readFile } from "node:fs/promises";
import type { IndexDocumentCommand } from "../domain/commands.js";
import type { EmbeddingClient, VectorStore } from "../domain/ports.js";

export class IndexDocumentUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly store: VectorStore,
  ) {}

  async execute(command: IndexDocumentCommand): Promise<number> {
    const content = await readFile(command.file, "utf8");
    const input = [
      `Category: ${command.category}`,
      `Taxonomy: ${command.taxonomy}`,
      command.description ? `Description: ${command.description}` : undefined,
      "",
      content,
    ]
      .filter(Boolean)
      .join("\n");

    const embedding = await this.embeddings.embed(input);

    return this.store.add({
      source: command.file,
      content,
      embedding,
      taxonomy: {
        category: command.category,
        taxonomy: command.taxonomy,
        description: command.description,
        metadata: command.metadata,
      },
    });
  }
}
