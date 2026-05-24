import { readFile } from "node:fs/promises";
import type { CategoryEntry } from "../../domain/entities.js";

interface MutableCategoryEntry {
  id?: string;
  path?: string;
  description?: string;
  examples: string[];
}

export async function loadTaxonomyFile(file: string): Promise<CategoryEntry[]> {
  const contents = await readFile(file, "utf8");
  return parseTaxonomyYaml(contents);
}

export function parseTaxonomyYaml(contents: string): CategoryEntry[] {
  const categories: MutableCategoryEntry[] = [];
  let current: MutableCategoryEntry | undefined;
  let inCategories = false;
  let inExamples = false;

  for (const rawLine of contents.split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/\s+#.*$/, "");
    const line = withoutComment.trim();

    if (!line) {
      continue;
    }

    if (line === "categories:") {
      inCategories = true;
      continue;
    }

    if (!inCategories) {
      continue;
    }

    if (line.startsWith("- id:")) {
      current = { id: parseScalar(line.slice("- id:".length)), examples: [] };
      categories.push(current);
      inExamples = false;
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("path:")) {
      current.path = parseScalar(line.slice("path:".length));
      inExamples = false;
      continue;
    }

    if (line.startsWith("description:")) {
      current.description = parseScalar(line.slice("description:".length));
      inExamples = false;
      continue;
    }

    if (line === "examples:") {
      inExamples = true;
      continue;
    }

    if (inExamples && line.startsWith("- ")) {
      current.examples.push(parseScalar(line.slice(2)));
    }
  }

  return categories.map((category, index) => {
    if (!category.id || !category.path) {
      throw new Error(`Invalid taxonomy category at index ${index}: id and path are required`);
    }

    return {
      id: category.id,
      path: category.path,
      description: category.description,
      examples: category.examples,
    };
  });
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
