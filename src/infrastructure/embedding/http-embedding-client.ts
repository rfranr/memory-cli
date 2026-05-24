import type { EmbeddingClient } from "../../domain/ports.js";

export class HttpEmbeddingClient implements EmbeddingClient {
  constructor(private readonly endpoint: string) {}

  async embed(input: string): Promise<number[]> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input, text: input }),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as unknown;
    const embedding = extractEmbedding(payload);

    if (!embedding) {
      throw new Error(`Embedding endpoint returned an invalid embedding payload: ${describePayload(payload)}`);
    }

    return embedding;
  }
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

  return extractEmbedding(payload.embedding) ?? extractEmbedding(payload.data);
}

function isEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "number");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describePayload(payload: unknown): string {
  if (Array.isArray(payload)) {
    return `array(length=${payload.length})`;
  }

  if (isRecord(payload)) {
    return `object(keys=${Object.keys(payload).join(",") || "none"})`;
  }

  return typeof payload;
}
