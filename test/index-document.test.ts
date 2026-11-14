import { describe, expect, it, vi } from 'vitest';
import { IndexDocumentUseCase } from '../src/application/index-document.js';
import type { DocumentChunk, Metadata } from '../src/domain/entities.js';

function makeEmbeddings() {
  const inputs: string[] = [];

  return {
    inputs,
    embed: vi.fn(async (input: string) => {
      inputs.push(input);

      return [input.length, 1];
    }),
  };
}

function makeVectorStore() {
  const records: DocumentChunk[] = [];

  return {
    records,
    init: vi.fn(async () => {}),
    add: vi.fn(async (chunk: DocumentChunk) => {
      records.push(chunk);

      return records.length;
    }),
    addMany: vi.fn(),
    isDocumentCurrent: vi.fn(async () => false),
    replaceDocument: vi.fn(async (_identity: string, _hash: string, chunks: DocumentChunk[]) => {
      const ids: number[] = [];

      for (const chunk of chunks) {
        records.push(chunk);
        ids.push(records.length);
      }

      return ids;
    }),
    search: vi.fn(),
    find: vi.fn(),
    stats: vi.fn(),
    close: vi.fn(async () => {}),
  };
}

describe('IndexDocumentUseCase', () => {
  it('indexes each chunk independently and returns chunk ids', async () => {
    const embeddings = makeEmbeddings();
    const store = makeVectorStore();
    const storeRecords = store.records;

    const useCase = new IndexDocumentUseCase(embeddings, store);
    const input = 'First paragraph.\n\nSecond paragraph.';
    const result = await useCase.execute({
      input,
      metadata: { fileName: 'doc.txt', location: 'note' } as Metadata,
    });

    // Default chunking merges small paragraphs into a larger chunk.
    expect(result).toEqual({ chunks: 1, ids: [1] });
    expect(embeddings.embed).toHaveBeenCalledTimes(1);
    expect(store.replaceDocument).toHaveBeenCalledTimes(1);
    expect(embeddings.inputs).toEqual([input]);

    expect(storeRecords[0]).toMatchObject({
      source: input,
      content: input,
      metadata: {
        fileName: 'doc.txt',
        location: 'note',
        chunkIndex: 0,
        chunkCount: 1,
        chunkStart: expect.any(Number),
        chunkEnd: expect.any(Number),
      },
    });
  });

  it('previews the same prepared chunks without writing', async () => {
    const embeddings = makeEmbeddings();
    const store = makeVectorStore();
    const useCase = new IndexDocumentUseCase(embeddings, store);
    const command = { input: 'A paragraph. '.repeat(500), metadata: { fileName: 'notes.txt' } };
    const preview = await useCase.execute({ ...command, dryRun: true });

    expect(preview.dryRun).toBe(true);
    expect(preview.chunks).toBeGreaterThan(1);
    expect(preview.ids).toEqual([]);
    expect(store.replaceDocument).not.toHaveBeenCalled();
    expect(store.add).not.toHaveBeenCalled();
    await useCase.execute(command);
    expect(preview.documents).toEqual(store.records);
  });

  it('rejects empty input during a dry run without writing', async () => {
    const store = makeVectorStore();
    const useCase = new IndexDocumentUseCase(makeEmbeddings(), store);

    await expect(useCase.execute({ input: '   ', metadata: {}, dryRun: true })).rejects.toThrow('non-empty chunks');
    expect(store.replaceDocument).not.toHaveBeenCalled();
  });
});
