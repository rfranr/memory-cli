import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface AppConfig {
  databasePath: string;
  categoriesDatabasePath: string;
  embeddingEndpoint: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

export interface ConfigOptions {
  db?: string;
  categoriesDb?: string;
  embeddingUrl?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimensions?: string;
  envFile?: string;
}

const loadedEnvFiles = new Set<string>();

export function buildConfig(options: ConfigOptions): AppConfig {
  loadEnvFile(options.envFile);

  return {
    databasePath: configValue(options.db, "RAG_CLI_DB", "./rag.sqlite"),
    categoriesDatabasePath: configValue(options.categoriesDb, "RAG_CLI_CATEGORIES_DB", "./rag-categories.sqlite"),
    embeddingEndpoint: configValue(options.embeddingUrl, "RAG_CLI_EMBEDDING_URL", "http://localhost:3000/embedding"),
    embeddingProvider: configValue(options.embeddingProvider, "RAG_CLI_EMBEDDING_PROVIDER", "unknown"),
    embeddingModel: configValue(options.embeddingModel, "RAG_CLI_EMBEDDING_MODEL", "unknown"),
    embeddingDimensions: parseEmbeddingDimensions(options.embeddingDimensions),
  };
}

// Explicit options override the environment; empty strings remain explicit values.
function configValue(option: string | undefined, environmentKey: string, fallback: string): string {
  return option ?? process.env[environmentKey] ?? fallback;
}

function parseEmbeddingDimensions(option: string | undefined): number {
  const dimensions = Number.parseInt(configValue(option, "RAG_CLI_EMBEDDING_DIMENSIONS", ""), 10);

  if (!Number.isFinite(dimensions) || dimensions <= 0) {
    throw new Error("RAG_CLI_EMBEDDING_DIMENSIONS must be a positive integer");
  }

  return dimensions;
}

export function loadEnvFile(envFile = ".env"): void {
  const absolutePath = resolve(process.cwd(), envFile);

  if (loadedEnvFiles.has(absolutePath)) {
    return;
  }

  loadedEnvFiles.add(absolutePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  const variables = parseEnvFile(readFileSync(absolutePath, "utf8"));

  for (const [key, value] of Object.entries(variables)) {
    process.env[key] ??= value;
  }
}

function parseEnvFile(contents: string): Record<string, string> {
  const variables: Record<string, string> = {};

  for (const rawLine of contents.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    variables[match[1]] = parseEnvValue(match[2]);
  }

  return variables;
}

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    const unquoted = value.slice(1, -1);

    if (quote === '"') {
      return unquoted.replace(/\\([nrt"\\])/g, (_, escaped: string) => {
        switch (escaped) {
          case "n":
            return "\n";
          case "r":
            return "\r";
          case "t":
            return "\t";
          default:
            return escaped;
        }
      });
    }

    return unquoted;
  }

  return value.replace(/\s+#.*$/, "").trim();
}
