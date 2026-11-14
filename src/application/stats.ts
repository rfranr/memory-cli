import type { AppStats } from '../domain/entities.js';
import type { VectorStore } from '../domain/ports.js';

export class StatsUseCase {
  constructor(
    private readonly store: VectorStore,
    private readonly databasePath: string,
  ) {}

  async execute(): Promise<AppStats> {
    return {
      documentsDb: this.databasePath,
      documents: await this.store.stats(),
    };
  }
}
