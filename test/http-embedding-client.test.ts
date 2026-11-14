import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpEmbeddingClient } from '../src/infrastructure/embedding/http-embedding-client.js';

afterEach(() => vi.unstubAllGlobals());

describe('HttpEmbeddingClient', () => {
  it('sends an Ollama array and preserves all embedding positions', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        embeddings: [
          [1, 0],
          [0, 1],
        ],
      }),
    );

    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpEmbeddingClient('http://localhost/api/embed', 'ollama', 'bge-m3');

    expect(await client.embedMany(['first', 'second'])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/api/embed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'bge-m3', input: ['first', 'second'] }),
    });
  });

  it.each([
    { embeddings: [[1]] },
    { embeddings: [[1], []] },
    { embeddings: [[1], ['bad']] },
    { data: [[1], [2]] },
    null,
  ])('rejects malformed batch %j', async (payload) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(payload)),
    );
    await expect(
      new HttpEmbeddingClient('http://localhost/api/embed', 'ollama', 'bge-m3').embedMany(['a', 'b']),
    ).rejects.toThrow('invalid batch');
  });

  it('falls back to sequential single requests for other providers', async () => {
    const fetchMock = vi.fn(async () => Response.json({ embedding: [1, 0] }));

    vi.stubGlobal('fetch', fetchMock);
    expect(await new HttpEmbeddingClient('http://localhost/embedding', 'llama.cpp').embedMany(['a', 'b'])).toEqual([
      [1, 0],
      [1, 0],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('propagates batch HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );
    await expect(new HttpEmbeddingClient('http://localhost/api/embed', 'ollama').embedMany(['a'])).rejects.toThrow(
      '500',
    );
  });

  it('sends the configured Ollama model and parses the first embedding', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        embeddings: [
          [1, 0],
          [0, 1],
        ],
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpEmbeddingClient('http://localhost:11434/api/embed', 'ollama', 'custom-model');

    expect(await client.embed('hello')).toEqual([1, 0]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/embed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'custom-model', input: 'hello' }),
    });
  });

  it.each(
    [[1, 0], { embedding: [1, 0] }, [{ embedding: [1, 0] }], { data: [{ embedding: [1, 0] }] }].map((payload) => ({
      payload,
    })),
  )('preserves llama.cpp response support for %j', async ({ payload }) => {
    const fetchMock = vi.fn(async () => Response.json(payload));

    vi.stubGlobal('fetch', fetchMock);

    const client = new HttpEmbeddingClient('http://localhost:8080/embedding', 'llama.cpp', 'legacy');

    expect(await client.embed('hello')).toEqual([1, 0]);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/embedding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'hello', text: 'hello' }),
    });
  });

  it.each(['ollama', 'llama.cpp'])('reports HTTP errors for %s', async (provider) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('model not found', { status: 404, statusText: 'Not Found' })),
    );
    await expect(
      new HttpEmbeddingClient('http://localhost/custom', provider, 'missing').embed('hello'),
    ).rejects.toThrow('Embedding request failed: 404 Not Found');
  });

  it.each([{ embeddings: [] }, { embeddings: [[]] }, { embeddings: [['invalid']] }, { error: 'failure' }])(
    'rejects invalid payload %j',
    async (payload) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(payload)),
      );
      await expect(new HttpEmbeddingClient('http://localhost/custom', 'ollama', 'test').embed('hello')).rejects.toThrow(
        'Embedding endpoint returned an invalid embedding payload',
      );
    },
  );
});
