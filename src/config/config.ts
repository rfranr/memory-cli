import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface AppConfig {
  databasePath: string;
  categoriesDatabasePath: string;
  embeddingEndpoint: string;
}

export interface ConfigOptions {
  db?: string;
  categoriesDb?: string;
  embeddingUrl?: string;
  envFile?: string;
}

const loadedEnvFiles = new Set<string>();

export function buildConfig(options: ConfigOptions): AppConfig {
  loadEnvFile(options.envFile);

  return {
    databasePath: options.db ?? process.env.RAG_CLI_DB ?? "./rag.sqlite",
    categoriesDatabasePath: options.categoriesDb ?? process.env.RAG_CLI_CATEGORIES_DB ?? "./rag-categories.sqlite",
    embeddingEndpoint: options.embeddingUrl ?? process.env.RAG_CLI_EMBEDDING_URL ?? "http://localhost:3000/embedding",
  };
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
