import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { homedir } from 'node:os';

export interface AppConfig {
  databasePath: string;
  embeddingEndpoint: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

export interface ConfigOptions {
  db?: string;
  embeddingUrl?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimensions?: string;
  envFile?: string;
}

const loadedEnvFiles = new Set<string>();

export function buildConfig(options: ConfigOptions): AppConfig {
  loadEnvFile(options.envFile);

  const embeddingDimensionsRaw = options.embeddingDimensions ?? process.env.RAG_CLI_EMBEDDING_DIMENSIONS ?? '';
  const embeddingDimensions = Number.parseInt(embeddingDimensionsRaw, 10);

  if (!Number.isFinite(embeddingDimensions) || embeddingDimensions <= 0) {
    throw new Error('RAG_CLI_EMBEDDING_DIMENSIONS must be a positive integer');
  }

  return {
    databasePath: configValue(options.db, 'RAG_CLI_DB', defaultDatabasePath()),
    embeddingEndpoint: configValue(options.embeddingUrl, 'RAG_CLI_EMBEDDING_URL', 'http://localhost:3000/embedding'),
    embeddingProvider: configValue(options.embeddingProvider, 'RAG_CLI_EMBEDDING_PROVIDER', 'unknown'),
    embeddingModel: configValue(options.embeddingModel, 'RAG_CLI_EMBEDDING_MODEL', 'unknown'),
    embeddingDimensions,
  };
}

export function defaultDatabasePath(): string {
  const home = homedir();

  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'memory-cli', 'rag.sqlite');
  }

  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'memory-cli', 'rag.sqlite');
  }

  const xdg = process.env.XDG_DATA_HOME;
  const dataHome = xdg && isAbsolute(xdg) ? xdg : join(home, '.local', 'share');

  return join(dataHome, 'memory-cli', 'rag.sqlite');
}

function configValue(value: string | undefined, variable: string, fallback: string): string {
  return value ?? process.env[variable] ?? fallback;
}

export function loadEnvFile(envFile = '.env'): void {
  const absolutePath = resolve(process.cwd(), envFile);

  if (loadedEnvFiles.has(absolutePath)) {
    return;
  }

  loadedEnvFiles.add(absolutePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  const variables = parseEnvFile(readFileSync(absolutePath, 'utf8'));

  for (const [key, value] of Object.entries(variables)) {
    if (key.startsWith('RAG_CLI_')) {
      process.env[key] ??= value;
    }
  }
}

function parseEnvFile(contents: string): Record<string, string> {
  const variables: Record<string, string> = {};

  for (const rawLine of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
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
          case 'n':
            return '\n';
          case 'r':
            return '\r';
          case 't':
            return '\t';
          default:
            return escaped;
        }
      });
    }

    return unquoted;
  }

  return value.replace(/\s+#.*$/, '').trim();
}
