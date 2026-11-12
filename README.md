# RAG-CLI

Local CLI for taxonomy-based document classification, indexing, and semantic search using embeddings.

## Setup

Install dependencies:

```bash
pnpm install
```

Configure `.env`:

```bash
RAG_CLI_DB=./rag.sqlite
RAG_CLI_CATEGORIES_DB=./rag-categories.sqlite
RAG_CLI_EMBEDDING_PROVIDER=llama.cpp
RAG_CLI_EMBEDDING_URL=http://localhost:8080/embedding
RAG_CLI_EMBEDDING_MODEL=granite-embedding-107m-multilingual
RAG_CLI_EMBEDDING_DIMENSIONS=384
```

For llama.cpp, use an endpoint accepting `POST /embedding`. For Ollama, configure:

```dotenv
RAG_CLI_EMBEDDING_PROVIDER=ollama
RAG_CLI_EMBEDDING_URL=http://localhost:11434/api/embed
RAG_CLI_EMBEDDING_MODEL=bge-m3
RAG_CLI_EMBEDDING_DIMENSIONS=1024
```

The configured model must be available in Ollama (for example, run `ollama pull bge-m3`).
Requests use the configured URL unchanged. Ollama requests send `model` and `input`
and read the first vector from `embeddings`; llama.cpp request and response formats
remain supported.

## Basic usage

### 1. Sync categories

`categories.yml` is the source of truth for categories.

```bash
pnpm run start categories sync assets/taxonomy/categories.yml
```

This embeds every category and stores it in the categories database.

### 2. Classify a text or file

```bash
pnpm run start classify assets/docs/doc.txt
```

This compares the input with the already-synced categories database.

### 3. Index a text, file, or URL

```bash
pnpm run start index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
pnpm run start index assets/docs/doc.txt --dry-run --metadata '{"fileName":"assets/docs/doc.txt"}'
pnpm run start index https://example.com/article --metadata '{"url":"https://example.com/article"}'
```

This splits the document into chunks and stores each chunk in the documents database with:

- chunk embedding
- best matching category
- user metadata
- chunk metadata such as `chunkIndex`, `chunkCount`, `chunkStart`, and `chunkEnd`

Example output:

```json
{
  "chunks": 3,
  "ids": [1, 2, 3]
}
```

Use `index --dry-run` to validate, chunk, embed, and classify the input without
writing databases. It requires an existing synced categories database and the
embedding service. JSON output includes `dryRun: true`, the chunk count, empty
`ids`, and prepared `documents` with content, embeddings, category, and metadata.
The documents database is not opened or created; categories are read-only.

### 4. Search indexed documents

```bash
pnpm run start search "Microsoft BASIC" --limit 5
```

Search returns the best scoring indexed texts with category and metadata (KNN via sqlite-vec).

### 5. Inspect database stats

```bash
pnpm run start stats
```

Or:

```bash
pnpm run start inspect
```

This prints a JSON summary of the documents and categories databases.

### 6. Find indexed chunks by filter

```bash
pnpm run start find --file machinelearning
pnpm run start find --text pipeline
pnpm run start find --category llms
```

You can combine filters and control pagination with `--limit` and `--offset`.

## Taxonomy format

Example:

```yaml
version: 1

categories:
  - id: software-architecture
    path: "Tecnologia / Desenvolupament / Arquitectura"
    description: "Notes sobre disseny de software."
    examples:
      - "Clean Architecture"
      - "DDD"
```

## Build

```bash
pnpm run build
```
