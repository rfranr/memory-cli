import type { TaxonomySyncCommand } from "../domain/commands.js";
import type { EmbeddingClient, CategoryStore } from "../domain/ports.js";
import { loadTaxonomyFile } from "../infrastructure/taxonomy/yaml-taxonomy-loader.js";

export class TaxonomySyncUseCase {
  constructor(
    private readonly embeddings: EmbeddingClient,
    private readonly categories: CategoryStore,
  ) {}

  async execute(command: TaxonomySyncCommand): Promise<number> {
    const taxonomyCategories = await loadTaxonomyFile(command.taxonomyFile);

    for (const category of taxonomyCategories) {
      await this.categories.upsert(category, await this.embeddings.embed(categoryEmbeddingText(category)));
    }

    return taxonomyCategories.length;
  }
}

export function categoryEmbeddingText(category: {
  id: string;
  path: string;
  description?: string;
  examples: string[];
}): string {
  return [
    `Category id: ${category.id}`,
    `Path: ${category.path}`,
    category.description ? `Description: ${category.description}` : undefined,
    category.examples.length > 0 ? `Examples: ${category.examples.join("; ")}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
