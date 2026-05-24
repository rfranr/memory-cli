import { IndexDocumentUseCase } from "../application/index-document.js";
import { SearchDocumentsUseCase } from "../application/search-documents.js";
import { buildConfig, type AppConfig, type ConfigOptions } from "../config/config.js";
import type { IndexDocumentCommand, SearchCommand } from "../domain/commands.js";
import type { SearchMatch } from "../domain/entities.js";
import { SqliteVectorStore } from "../infrastructure/database/sqlite-vector-store.js";
import { HttpEmbeddingClient } from "../infrastructure/embedding/http-embedding-client.js";

export class RagCliApp {
  constructor(private readonly config: AppConfig) {}

  async indexDocument(command: IndexDocumentCommand): Promise<number> {
    const { store, embeddings } = await this.dependencies();
    try {
      return await new IndexDocumentUseCase(embeddings, store).execute(command);
    } finally {
      await store.close();
    }
  }

  async search(command: SearchCommand): Promise<SearchMatch[]> {
    const { store, embeddings } = await this.dependencies();
    try {
      return await new SearchDocumentsUseCase(embeddings, store).execute(command);
    } finally {
      await store.close();
    }
  }

  private async dependencies(): Promise<{
    store: SqliteVectorStore;
    embeddings: HttpEmbeddingClient;
  }> {
    const store = new SqliteVectorStore(this.config.databasePath);
    await store.init();

    return {
      store,
      embeddings: new HttpEmbeddingClient(this.config.embeddingEndpoint),
    };
  }
}

export function createApp(options: ConfigOptions): RagCliApp {
  return new RagCliApp(buildConfig(options));
}
