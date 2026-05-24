import { ClassifyDocumentUseCase } from "../application/classify-document.js";
import { IndexDocumentUseCase } from "../application/index-document.js";
import { SearchDocumentsUseCase } from "../application/search-documents.js";
import { StatsUseCase } from "../application/stats.js";
import { TaxonomySyncUseCase } from "../application/taxonomy-sync.js";
import { buildConfig, type AppConfig, type ConfigOptions } from "../config/config.js";
import type { ClassifyCommand, IndexDocumentCommand, SearchCommand, TaxonomySyncCommand } from "../domain/commands.js";
import type { AppStats, CategoryMatch, IndexDocumentResult, SearchMatch } from "../domain/entities.js";
import { SqliteCategoryStore } from "../infrastructure/database/sqlite-category-store.js";
import { SqliteVectorStore } from "../infrastructure/database/sqlite-vector-store.js";
import { HttpEmbeddingClient } from "../infrastructure/embedding/http-embedding-client.js";
import { createStderrProgressReporter } from "../shared/progress.js";

export class RagCliApp {
  constructor(private readonly config: AppConfig) {}

  async syncTaxonomy(command: TaxonomySyncCommand): Promise<number> {
    const { store, categories, embeddings } = await this.dependencies();
    try {
      return await new TaxonomySyncUseCase(embeddings, categories).execute(command, createStderrProgressReporter("Syncing categories"));
    } finally {
      await Promise.all([store.close(), categories.close()]);
    }
  }

  async classify(command: ClassifyCommand): Promise<CategoryMatch[]> {
    const { store, categories, embeddings } = await this.dependencies();
    try {
      return await new ClassifyDocumentUseCase(embeddings, categories).execute(command);
    } finally {
      await Promise.all([store.close(), categories.close()]);
    }
  }

  async indexDocument(command: IndexDocumentCommand): Promise<IndexDocumentResult> {
    const { store, categories, embeddings } = await this.dependencies();
    try {
      return await new IndexDocumentUseCase(embeddings, store, categories).execute(command, createStderrProgressReporter("Indexing chunks"));
    } finally {
      await Promise.all([store.close(), categories.close()]);
    }
  }

  async stats(): Promise<AppStats> {
    const { store, categories } = await this.storeDependencies();
    try {
      return await new StatsUseCase(store, categories, this.config.databasePath, this.config.categoriesDatabasePath).execute();
    } finally {
      await Promise.all([store.close(), categories.close()]);
    }
  }

  async search(command: SearchCommand): Promise<SearchMatch[]> {
    const { store, categories, embeddings } = await this.dependencies();
    try {
      return await new SearchDocumentsUseCase(embeddings, store).execute(command);
    } finally {
      await Promise.all([store.close(), categories.close()]);
    }
  }

  private async dependencies(): Promise<{
    store: SqliteVectorStore;
    categories: SqliteCategoryStore;
    embeddings: HttpEmbeddingClient;
  }> {
    const store = new SqliteVectorStore(this.config.databasePath);
    const categories = new SqliteCategoryStore(this.config.categoriesDatabasePath);
    await Promise.all([store.init(), categories.init()]);

    return {
      store,
      categories,
      embeddings: new HttpEmbeddingClient(this.config.embeddingEndpoint),
    };
  }

  private async storeDependencies(): Promise<{
    store: SqliteVectorStore;
    categories: SqliteCategoryStore;
  }> {
    const store = new SqliteVectorStore(this.config.databasePath);
    const categories = new SqliteCategoryStore(this.config.categoriesDatabasePath);
    await Promise.all([store.init(), categories.init()]);

    return { store, categories };
  }
}

export function createApp(options: ConfigOptions): RagCliApp {
  return new RagCliApp(buildConfig(options));
}
