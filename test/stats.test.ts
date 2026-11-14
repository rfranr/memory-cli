import { describe, expect, it, vi } from 'vitest';
import { StatsUseCase } from '../src/application/stats.js';

describe('StatsUseCase', () => {
  it('returns document chunk and source counts', async () => {
    const store = { stats: vi.fn(async () => ({ chunks: 12, sources: 4 })) };
    const useCase = new StatsUseCase(store as never, './rag.sqlite');

    await expect(useCase.execute()).resolves.toEqual({
      documentsDb: './rag.sqlite',
      documents: { chunks: 12, sources: 4 },
    });
  });
});
