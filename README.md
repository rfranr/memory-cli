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
RAG_CLI_EMBEDDING_URL=http://localhost:8080/embedding
```

The embedding endpoint must accept `POST /embedding`.

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

### 3. Index a text or file

```bash
pnpm run start index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
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

### 4. Search indexed documents

```bash
pnpm run start search "Microsoft BASIC" --limit 5
```

Search returns the best scoring indexed texts with category and metadata.

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
