import type { EmbeddingClient } from "../../domain/ports.js";

interface DirectEmbeddingResponse {
  embedding: number[];
}

interface OpenAiEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

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

    const payload = (await response.json()) as DirectEmbeddingResponse | OpenAiEmbeddingResponse;
    const embedding = "embedding" in payload ? payload.embedding : payload.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== "number")) {
      throw new Error("Embedding endpoint returned an invalid embedding payload");
    }

    return embedding;
  }
}
