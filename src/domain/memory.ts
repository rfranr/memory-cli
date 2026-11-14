export interface Memory {
  id: string;
  scope: 'project';
  project: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function validateMemoryId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid memory ID');
  }
}

export function validateMemoryContent(content: string): void {
  if (!content.trim()) {
    throw new Error('Memory content must not be empty');
  }
}
