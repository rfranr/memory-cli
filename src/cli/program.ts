import { Command } from 'commander';
import type { Metadata } from '../domain/entities.js';

export interface CommonOptions {
  db?: string;
  embeddingUrl?: string;
  envFile?: string;
}

export interface CliApp {
  indexDocument(command: { input: string; metadata: Metadata; dryRun?: boolean }): Promise<unknown>;
  stats(): Promise<unknown>;
  find(command: { file?: string; text?: string; limit: number; offset: number }): Promise<unknown>;
  search(command: { text: string; limit: number }): Promise<unknown>;
}

export type AppFactory = (options: CommonOptions) => Promise<CliApp> | CliApp;

interface IndexOptions extends CommonOptions {
  dryRun?: boolean;
  metadata?: string;
}

interface FindOptions extends CommonOptions {
  file?: string;
  text?: string;
  limit?: string;
  offset?: string;
}

interface SearchOptions extends CommonOptions {
  limit?: string;
}

export function buildProgram(createApp: AppFactory = defaultCreateApp): Command {
  const program = new Command();

  program
    .name('rag-cli')
    .description('Index content and search nearest occurrences using embeddings')
    .version('1.0.0')
    .option('--db <path>', 'SQLite documents database path')
    .option('--embedding-url <url>', 'POST /embedding endpoint URL')
    .option('--env-file <path>', '.env file path', '.env');

  registerDocumentCommands(program, createApp);
  registerSearchCommands(program, createApp);

  return program;
}

function registerDocumentCommands(program: Command, createApp: AppFactory): void {
  program
    .command('index')
    .description('Embed and persist text/file chunks with user metadata')
    .argument('<input>', 'Text to index, or a file path')
    .option('-m, --metadata <json>', 'Additional JSON metadata', '{}')
    .option('--dry-run', 'Preview prepared chunks without changing persisted state')
    .action(async (input: string, options: IndexOptions) => {
      const app = await createApp(resolveCommonOptions(program, options));
      const result = await app.indexDocument({
        input,
        metadata: parseMetadata(options.metadata),
        ...(options.dryRun ? { dryRun: true } : {}),
      });

      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('stats')
    .alias('inspect')
    .description('Show document and chunk counts')
    .action(async (options: CommonOptions) => {
      const app = await createApp(resolveCommonOptions(program, options));
      const stats = await app.stats();

      console.log(JSON.stringify(stats, null, 2));
    });
}

function registerSearchCommands(program: Command, createApp: AppFactory): void {
  program
    .command('find')
    .description('Filter indexed documents and chunks by file or text')
    .option('--file <value>', 'Filter by source file/path')
    .option('--text <value>', 'Filter by stored text content')
    .option('-l, --limit <number>', 'Maximum matches', '20')
    .option('-o, --offset <number>', 'Result offset', '0')
    .action(async (options: FindOptions) => {
      validateFindOptions(options);
      const app = await createApp(resolveCommonOptions(program, options));
      const result = await app.find({
        file: options.file,
        text: options.text,
        limit: Number.parseInt(options.limit ?? '20', 10),
        offset: Number.parseInt(options.offset ?? '0', 10),
      });

      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('search')
    .description('Embed text and return nearest stored occurrences sorted by similarity')
    .argument('<text>', 'Search text')
    .option('-l, --limit <number>', 'Maximum matches', '10')
    .action(async (text: string, options: SearchOptions) => {
      const app = await createApp(resolveCommonOptions(program, options));
      const matches = await app.search({ text, limit: Number.parseInt(options.limit ?? '10', 10) });

      console.log(JSON.stringify(matches, null, 2));
    });
}

function resolveCommonOptions(program: Command, options: CommonOptions): CommonOptions {
  const globalOptions = program.opts<CommonOptions>();

  return {
    db: options.db ?? globalOptions.db,
    embeddingUrl: options.embeddingUrl ?? globalOptions.embeddingUrl,
    envFile: options.envFile ?? globalOptions.envFile,
  };
}

export function parseMetadata(value = '{}'): Metadata {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('--metadata must be a JSON object');
  }

  return parsed as Metadata;
}

function validateFindOptions(options: FindOptions): void {
  if (!options.file && !options.text) {
    throw new Error('find requires at least one filter: --file or --text');
  }
}

async function defaultCreateApp(options: CommonOptions): Promise<CliApp> {
  const { createApp } = await import('../core/core.js');

  return createApp(options) as unknown as CliApp;
}
