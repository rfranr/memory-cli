import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ClassifyCommand } from "../domain/commands.js";
import type { CategoryMatch } from "../domain/entities.js";
import type { CategoryStore, EmbeddingClient } from "../domain/ports.js";

export class ClassifyDocumentUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly categories: CategoryStore,
  ) {}

  async execute(command: ClassifyCommand): Promise<CategoryMatch[]> {
    const content = await readInput(command.input);
    const embedding = await this.embeddings.embed(content);
    return this.categories.search(embedding, command.limit);
  }
}

export async function readInput(input: string): Promise<string> {
  return existsSync(input) ? readFile(input, "utf8") : input;
}
