import type { FindCommand } from "../domain/commands.js";
import type { FindResult } from "../domain/entities.js";
import type { VectorStore } from "../domain/ports.js";

export class FindDocumentsUseCase {
  constructor(private readonly store: VectorStore) {}

  async execute(command: FindCommand): Promise<FindResult> {
    validateFilters(command);
    return this.store.find({
      file: command.file,
      text: command.text,
      category: command.category,
      limit: command.limit,
      offset: command.offset,
    });
  }
}

function validateFilters(command: FindCommand): void {
  if (!command.file && !command.text && !command.category) {
    throw new Error("find requires at least one filter: --file, --text, or --category");
  }

  if (!Number.isInteger(command.limit) || command.limit < 0) {
    throw new Error("find limit must be a non-negative integer");
  }

  if (!Number.isInteger(command.offset) || command.offset < 0) {
    throw new Error("find offset must be a non-negative integer");
  }
}
