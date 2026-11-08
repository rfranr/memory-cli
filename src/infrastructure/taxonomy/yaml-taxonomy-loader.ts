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
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter(Boolean);
  const categoriesStart = lines.indexOf("categories:");

  if (categoriesStart === -1) {
    return [];
  }

  return collectCategories(lines.slice(categoriesStart + 1)).map((category, index) => {
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

function collectCategories(lines: string[]): MutableCategoryEntry[] {
  const categories: MutableCategoryEntry[] = [];
  let current: MutableCategoryEntry | undefined;
  let inExamples = false;

  for (const line of lines) {
    if (line.startsWith("- id:")) {
      current = { id: parseScalar(line.slice("- id:".length)), examples: [] };
      categories.push(current);
      inExamples = false;
      continue;
    }

    if (!current) {
      continue;
    }

    inExamples = parseCategoryFields(current, line, inExamples);
  }

  return categories;
}

// Only known scalar fields end the examples list; ignored lines preserve parser state.
function parseCategoryFields(current: MutableCategoryEntry, line: string, inExamples: boolean): boolean {
  if (line.startsWith("path:")) {
    current.path = parseScalar(line.slice("path:".length));

    return false;
  }

  if (line.startsWith("description:")) {
    current.description = parseScalar(line.slice("description:".length));

    return false;
  }

  if (line === "examples:") {
    return true;
  }

  if (inExamples && line.startsWith("- ")) {
    current.examples.push(parseScalar(line.slice(2)));
  }

  return inExamples;
}

function parseScalar(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
