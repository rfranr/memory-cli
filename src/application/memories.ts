import { randomUUID } from 'node:crypto';
import { type Memory, validateMemoryContent, validateMemoryId } from '../domain/memory.js';
import type { EmbeddingClient } from '../domain/ports.js';

export interface MemoryStore {
  getMemory(id: string): Promise<Memory | null>;
  listMemories(project: string): Promise<Memory[]>;
  saveMemory(memory: Memory, embedding: number[], create: boolean): Promise<void>;
  forgetMemory(id: string): Promise<void>;
}

export class Memories {
  constructor(
    private readonly store: MemoryStore,
    private readonly embeddings: EmbeddingClient,
  ) {}

  async remember(content: string, project: string, scope = 'project'): Promise<Memory> {
    validateMemoryContent(content);
    validateProject(project);

    if (scope !== 'project') {
      throw new Error('Only project scope is supported');
    }
    const now = new Date().toISOString();
    const memory: Memory = { id: randomUUID(), scope, project, content, createdAt: now, updatedAt: now };

    await this.store.saveMemory(memory, await this.embeddings.embed(content), true);

    return memory;
  }

  async get(id: string): Promise<Memory | null> {
    validateMemoryId(id);

    return this.store.getMemory(id);
  }

  async list(project: string): Promise<Memory[]> {
    validateProject(project);

    return this.store.listMemories(project);
  }

  async update(id: string, content: string): Promise<Memory> {
    validateMemoryContent(content);
    const previous = await this.get(id);

    if (!previous) {
      throw new Error('Memory not found');
    }
    if (previous.content === content) {
      return previous;
    }
    const memory = { ...previous, content, updatedAt: new Date().toISOString() };

    await this.store.saveMemory(memory, await this.embeddings.embed(content), false);

    return memory;
  }

  async forget(id: string): Promise<{ id: string; forgotten: true }> {
    validateMemoryId(id);
    await this.store.forgetMemory(id);

    return { id, forgotten: true };
  }
}

function validateProject(project: string): void {
  if (!project?.trim()) {
    throw new Error('An explicit project identifier is required');
  }
}
