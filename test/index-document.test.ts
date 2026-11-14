import { describe, expect, it, vi } from 'vitest';
import { SearchDocumentsUseCase } from '../src/application/search-documents.js';
import { IndexDocumentUseCase } from '../src/application/index-document.js';
import { chunkText } from '../src/shared/chunk-text.js';
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
  it.each([3, 8, 9, 18, 64])('embeds %i chunks in ordered bounded batches', async (count) => {
    const input = Array.from({ length: count }, (_, i) => `${i}: ${'word '.repeat(200)}`).join('\n\n');
    const chunks = chunkText(input);

    expect(chunks).toHaveLength(count);
    const embedMany = vi.fn(async (inputs: string[]) => inputs.map((text) => [Number(text.split(':')[0]), 1]));
    const store = makeVectorStore();

    await new IndexDocumentUseCase({ embed: vi.fn(), embedMany }, store).execute({
      input,
      metadata: { custom: 'kept' },
    });
    expect(embedMany.mock.calls.map(([inputs]) => inputs.length)).toEqual(
      Array.from({ length: Math.ceil(count / 8) }, (_, i) => Math.min(8, count - i * 8)),
    );
    expect(store.records).toEqual(
      chunks.map((chunk, i) => ({
        source: input,
        content: chunk.content,
        embedding: [i, 1],
        metadata: {
          custom: 'kept',
          chunkIndex: i,
          chunkCount: count,
          chunkStart: chunk.chunkStart,
          chunkEnd: chunk.chunkEnd,
        },
      })),
    );
  });

  it.each(['count', 'malformed', 'http'])(
    'does not replace a valid document after intermediate %s failure',
    async (failure) => {
      const input = Array.from({ length: 18 }, (_, i) => `${i}: ${'word '.repeat(200)}`).join('\n\n');
      const store = makeVectorStore();
      const previous = { source: 'old', content: 'valid', embedding: [1], metadata: {} };

      store.records.push(previous);
      const embedMany = vi.fn().mockResolvedValueOnce(Array.from({ length: 8 }, () => [1]));

      if (failure === 'http') {
        embedMany.mockRejectedValueOnce(new Error('Embedding request failed: 500'));
      } else {
        embedMany.mockResolvedValueOnce(failure === 'count' ? [[1]] : Array.from({ length: 8 }, () => [NaN]));
      }

      await expect(
        new IndexDocumentUseCase({ embed: vi.fn(), embedMany }, store).execute({ input, metadata: {} }),
      ).rejects.toThrow();
      expect(embedMany).toHaveBeenCalledTimes(2);
      expect(store.replaceDocument).not.toHaveBeenCalled();
      expect(store.records).toEqual([previous]);
    },
  );

  it('skips all embedding calls for an unchanged document', async () => {
    const store = makeVectorStore();
    const embeddings = { embed: vi.fn(), embedMany: vi.fn() };

    store.isDocumentCurrent.mockResolvedValue(true);
    expect(await new IndexDocumentUseCase(embeddings, store).execute({ input: 'unchanged', metadata: {} })).toEqual({
      chunks: 0,
      ids: [],
    });
    expect(embeddings.embedMany).not.toHaveBeenCalled();
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(store.replaceDocument).not.toHaveBeenCalled();
  });

  it('keeps semantic search on single-query embeddings', async () => {
    const store = makeVectorStore();
    const embeddings = { embed: vi.fn(async () => [1, 0]), embedMany: vi.fn() };

    store.search.mockResolvedValue([]);
    expect(await new SearchDocumentsUseCase(embeddings, store).execute({ text: 'query', limit: 5 })).toEqual([]);
    expect(embeddings.embed).toHaveBeenCalledWith('query');
    expect(embeddings.embedMany).not.toHaveBeenCalled();
    expect(store.search).toHaveBeenCalledWith([1, 0], 5);
  });

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
