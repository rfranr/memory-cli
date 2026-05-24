import type { AppStats } from "../domain/entities.js";
import type { CategoryStore, VectorStore } from "../domain/ports.js";

export class StatsUseCase {
  constructor(
    private readonly store: VectorStore,
    private readonly categories: CategoryStore,
    private readonly databasePath: string,
    private readonly categoriesDatabasePath: string,
  ) {}

  async execute(): Promise<AppStats> {
    const [documents, categoriesSynced] = await Promise.all([this.store.stats(), this.categories.count()]);

    return {
      documentsDb: this.databasePath,
      categoriesDb: this.categoriesDatabasePath,
      documents,
      categories: {
        synced: categoriesSynced,
      },
    };
  }
}
