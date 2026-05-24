import { Command } from "commander";
import type { Metadata } from "../domain/entities.js";

interface CommonOptions {
  db?: string;
  embeddingUrl?: string;
  envFile?: string;
}

interface IndexOptions extends CommonOptions {
  category: string;
  taxonomy: string;
  description?: string;
  metadata?: string;
}

interface SearchOptions extends CommonOptions {
  limit?: string;
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("rag-cli")
    .description("Index categorized taxonomy documents and search nearest occurrences using embeddings")
    .version("1.0.0")
    .option("--db <path>", "SQLite database path")
    .option("--embedding-url <url>", "POST /embedding endpoint URL")
    .option("--env-file <path>", ".env file path", ".env");

  program
    .command("index")
    .description("Embed and persist one document with category/taxonomy metadata")
    .argument("<file>", "Document file to index")
    .requiredOption("-c, --category <category>", "Category name")
    .requiredOption("-t, --taxonomy <taxonomy>", "Taxonomy name/path")
    .option("-d, --description <description>", "Taxonomy description")
    .option("-m, --metadata <json>", "Additional JSON metadata", "{}")
    .action(async (file: string, options: IndexOptions) => {
      const { createApp } = await import("../core/core.js");
      const app = createApp(resolveCommonOptions(program, options));
      const id = await app.indexDocument({
        file,
        category: options.category,
        taxonomy: options.taxonomy,
        description: options.description,
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
