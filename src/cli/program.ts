import { Command } from "commander";
import type { Metadata } from "../domain/entities.js";

interface CommonOptions {
  db?: string;
  categoriesDb?: string;
  embeddingUrl?: string;
  envFile?: string;
}

interface ClassifyOptions extends CommonOptions {
  limit?: string;
}

interface IndexOptions extends CommonOptions {
  metadata?: string;
}

interface SearchOptions extends CommonOptions {
  limit?: string;
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("rag-cli")
    .description("Sync taxonomy categories, index categorized content, and search nearest occurrences using embeddings")
    .version("1.0.0")
    .option("--db <path>", "SQLite documents database path")
    .option("--categories-db <path>", "SQLite categories database path")
    .option("--embedding-url <url>", "POST /embedding endpoint URL")
    .option("--env-file <path>", ".env file path", ".env");

  const categories = program.command("categories").description("Manage the categories embedding database");

  categories
    .command("sync")
    .description("Read the source-of-truth categories.yml and upsert category embeddings")
    .argument("<taxonomy-file>", "Taxonomy YAML file, for example assets/taxonomy/categories.yml")
    .action(async (taxonomyFile: string, options: CommonOptions) => {
      const { createApp } = await import("../core/core.js");
      const app = createApp(resolveCommonOptions(program, options));
      const count = await app.syncTaxonomy({ taxonomyFile });
      console.log(JSON.stringify({ categories: count }, null, 2));
    });

  program
    .command("classify")
    .description("Classify text/file against the already-synced categories database")
    .argument("<input>", "Text to classify, or a file path")
    .option("-l, --limit <number>", "Maximum category matches", "5")
    .action(async (input: string, options: ClassifyOptions) => {
      const { createApp } = await import("../core/core.js");
      const app = createApp(resolveCommonOptions(program, options));
      const matches = await app.classify({
        input,
        limit: Number.parseInt(options.limit ?? "5", 10),
      });
      console.log(JSON.stringify(matches, null, 2));
    });

  program
    .command("index")
    .description("Embed and persist text/file with user metadata and the best category from the categories DB")
    .argument("<input>", "Text to index, or a file path")
    .option("-m, --metadata <json>", "Additional JSON metadata", "{}")
    .action(async (input: string, options: IndexOptions) => {
      const { createApp } = await import("../core/core.js");
      const app = createApp(resolveCommonOptions(program, options));
      const id = await app.indexDocument({
        input,
        metadata: parseMetadata(options.metadata),
      });
      console.log(JSON.stringify({ id }, null, 2));
    });

  program
    .command("search")
    .description("Embed text and return nearest stored occurrences sorted by similarity")
    .argument("<text>", "Search text")
    .option("-l, --limit <number>", "Maximum matches", "10")
    .action(async (text: string, options: SearchOptions) => {
      const { createApp } = await import("../core/core.js");
      const app = createApp(resolveCommonOptions(program, options));
      const matches = await app.search({ text, limit: Number.parseInt(options.limit ?? "10", 10) });
      console.log(JSON.stringify(matches, null, 2));
    });

  return program;
}

function resolveCommonOptions(program: Command, options: CommonOptions): CommonOptions {
  const globalOptions = program.opts<CommonOptions>();
  return {
    db: options.db ?? globalOptions.db,
    categoriesDb: options.categoriesDb ?? globalOptions.categoriesDb,
    embeddingUrl: options.embeddingUrl ?? globalOptions.embeddingUrl,
    envFile: options.envFile ?? globalOptions.envFile,
  };
}

function parseMetadata(value = "{}"): Metadata {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("--metadata must be a JSON object");
  }

  return parsed as Metadata;
}
