import { registerInspection, type InspectionApp } from './observability.js';
import { Command } from 'commander';
import type { Metadata } from '../domain/entities.js';

export interface CommonOptions {
  db?: string;
  embeddingUrl?: string;
  envFile?: string;
}

export interface CliApp {
  indexDocument(command: { input: string; metadata: Metadata; dryRun?: boolean }): Promise<unknown>;
  forget?(source: string): Promise<unknown>;
  remember?(content: string, project: string, scope: string): Promise<unknown>;
  memoryList?(project: string): Promise<unknown>;
  memoryGet?(id: string): Promise<unknown>;
  memoryUpdate?(id: string, content: string): Promise<unknown>;
  memoryForget?(id: string): Promise<unknown>;
  stats(): Promise<unknown>;
  find(command: { file?: string; text?: string; limit: number; offset: number }): Promise<unknown>;
  search(command: { text: string; limit: number; project?: string }): Promise<unknown>;
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
  project?: string;
  limit?: string;
}

export function buildProgram(createApp: AppFactory = defaultCreateApp): Command {
  const program = new Command();

  program
    .name('memory-cli')
    .description('Index content and search nearest occurrences using embeddings')
    .version('1.0.0')
    .option('--db <path>', 'SQLite documents database path')
    .option('--embedding-url <url>', 'POST /embedding endpoint URL')
    .option('--env-file <path>', '.env file path', '.env');

  program
    .command('forget')
    .description('Permanently exclude a source from this index without deleting the source file')
    .requiredOption('--source <source>', 'Source file, URL, or literal text')
    .action(async (options: CommonOptions & { source: string }) => {
      const app = await createApp(resolveCommonOptions(program, options));

      console.log(JSON.stringify(await app.forget!(options.source), null, 2));
    });

  registerInspection(
    program,
    async () => (await createApp(resolveCommonOptions(program, {}))) as unknown as InspectionApp,
  );
  registerMemoryCommands(program, createApp);
  registerDocumentCommands(program, createApp);
  registerSearchCommands(program, createApp);

  return program;
}

function registerMemoryCommands(program: Command, createApp: AppFactory): void {
  const app = () => createApp(resolveCommonOptions(program, {}));
  const output = (value: unknown) => console.log(JSON.stringify(value, null, 2));

  program
    .command('remember')
    .argument('<content>')
    .requiredOption('--scope <scope>', 'Memory scope (project only)')
    .requiredOption('--project <identifier>', 'Explicit project identifier')
    .action(async (content: string, options: { project: string; scope: string }) => {
      output(await (await app()).remember!(content, options.project, options.scope));
    });
  const memories = program.command('memories').description('Manage explicit project memories');

  memories
    .command('list')
    .requiredOption('--project <identifier>', 'Explicit project identifier')
    .action(async (options: { project: string }) => output(await (await app()).memoryList!(options.project)));
  memories
    .command('get')
    .argument('<id>')
    .action(async (id: string) => output(await (await app()).memoryGet!(id)));
  memories
    .command('update')
    .argument('<id>')
    .argument('<content>')
    .action(async (id: string, content: string) => output(await (await app()).memoryUpdate!(id, content)));
  memories
    .command('forget')
    .argument('<id>')
    .action(async (id: string) => output(await (await app()).memoryForget!(id)));
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
    .option('--project <name>', 'Only return records associated with this project')
    .option('-l, --limit <number>', 'Maximum matches', '10')
    .action(async (text: string, options: SearchOptions) => {
      const app = await createApp(resolveCommonOptions(program, options));
      const matches = await app.search({
        text,
        limit: Number.parseInt(options.limit ?? '10', 10),
        ...(options.project !== undefined ? { project: options.project } : {}),
      });

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
