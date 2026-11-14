import type { EmbeddingClient } from '../../domain/ports.js';

export class HttpEmbeddingClient implements EmbeddingClient {
  constructor(
    private readonly endpoint: string,
    private readonly provider?: string,
    private readonly model?: string,
  ) {}

  async embedMany(inputs: string[]): Promise<number[][]> {
    if (inputs.length === 0) {
      return [];
    }

    if (this.provider !== 'ollama') {
      const embeddings: number[][] = [];

      for (const input of inputs) {
        embeddings.push(await this.embed(input));
      }

      return embeddings;
    }

    const payload = await this.request(inputs);
    const embeddings = batchEmbeddings(payload);

    if (!Array.isArray(embeddings) || embeddings.length !== inputs.length || !embeddings.every(isEmbedding)) {
      throw new Error('Embedding endpoint returned an invalid batch embedding payload or count');
    }

    return embeddings as number[][];
  }

  private async request(input: string | string[]): Promise<unknown> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.provider === 'ollama' ? { model: this.model, input } : { input, text: input }),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async embed(input: string): Promise<number[]> {
    const payload = await this.request(input);
    const embedding = extractEmbedding(payload);

    if (!embedding) {
      throw new Error(`Embedding endpoint returned an invalid embedding payload: ${describePayload(payload)}`);
    }

    return embedding;
  }
}

function batchEmbeddings(payload: unknown): unknown {
  return isRecord(payload) ? payload.embeddings : undefined;
}

function extractEmbedding(payload: unknown): number[] | undefined {
  if (isEmbedding(payload)) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return extractEmbedding(payload[0]);
  }

  if (!isRecord(payload)) {
    return undefined;
  }

  return extractEmbedding(payload.embedding) ?? extractEmbedding(payload.embeddings) ?? extractEmbedding(payload.data);
}

function isEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describePayload(payload: unknown): string {
  if (Array.isArray(payload)) {
    return `array(length=${payload.length})`;
  }

  if (isRecord(payload)) {
    return `object(keys=${Object.keys(payload).join(',') || 'none'})`;
  }

  return typeof payload;
}
