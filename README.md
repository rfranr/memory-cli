# RAG-CLI

Local CLI for document indexing and semantic search using embeddings.

Documents → Chunks → Embeddings → Vector Store → Search

## Setup

Install dependencies:

```bash
pnpm install
```

Configure `.env`:

```bash
RAG_CLI_DB=./rag.sqlite
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
Indexing sends sequential batches of at most 8 chunks to Ollama's `/api/embed`
endpoint. Other providers retain sequential single-input requests, including
`POST /embedding`. Search continues to use a single query embedding. Batch results
must contain one non-empty, finite vector per input, in input order. Embedding
failures write no partial document and leave the previous indexed version intact.
See [batching measurements](docs/embedding-batching.md) for local benchmark results.
Requests use the configured URL unchanged. Ollama requests send `model` and `input`
and read the first vector from `embeddings`; llama.cpp request and response formats
remain supported.

## Basic usage

### 1. Index a text, file, or URL

```bash
pnpm run start index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
pnpm run start index assets/docs/doc.txt --dry-run --metadata '{"fileName":"assets/docs/doc.txt"}'
pnpm run start index https://example.com/article --metadata '{"url":"https://example.com/article"}'
```

This splits the document into chunks and stores each chunk in the documents database with:

- chunk embedding
- user metadata
- chunk metadata such as `chunkIndex`, `chunkCount`, `chunkStart`, and `chunkEnd`

Example output:

```json
{
  "chunks": 3,
  "ids": [1, 2, 3]
}
```

Repeating `index` for unchanged content returns `{"chunks":0,"ids":[]}` without
embedding again. Files are identified by their absolute real path (including symlink
resolution), URLs by their normalized URL, and literal text by its exact value.
Changed content at the same source atomically replaces its tracked chunks and vectors;
failed updates preserve the previous version. Metadata-only changes are skipped too.
Renaming a file or changing literal text creates a new document identity.

Existing chunks from older versions are retained, not automatically adopted or removed.
The first indexing after upgrading creates a tracked version alongside any legacy
chunks; subsequent updates replace only that tracked version. Back up existing databases
before any manual cleanup of legacy duplicates.

Use `index --dry-run` to validate, chunk, and embed the input without opening or
creating a database. Only the embedding service is required. JSON output includes
`dryRun: true`, the chunk count, empty `ids`, and prepared `documents` with source,
content, embeddings, and metadata. No taxonomy initialization is needed.

### 2. Search indexed documents

```bash
pnpm run start search "Microsoft BASIC" --limit 5
```

Search embeds the query and retrieves document chunks using sqlite-vec KNN,
sorted by descending cosine similarity. Each result includes `id`, `source`,
`content`, top-level `metadata` (all user and chunk metadata), and `score`.

### 3. Inspect database stats

```bash
pnpm run start stats
```

Or:

```bash
pnpm run start inspect
```

This prints `documentsDb` and `documents: { chunks, sources }`.

### 4. Find indexed chunks by filter

```bash
pnpm run start find --file machinelearning
pnpm run start find --text pipeline
```

You can combine filters and control pagination with `--limit` and `--offset`.

## Compatibility

Taxonomy classification has been removed: `categories sync`, `classify`,
`--categories-db`, `RAG_CLI_CATEGORIES_DB`, and `find --category` are no longer used.
Results and dry-run documents now expose `metadata` directly, not `taxonomy.metadata`.
Category distribution and synchronization counts are no longer returned by stats.

Existing document databases work without rebuilding: IDs, source references,
content, metadata, embeddings, and vector rows are retained. Legacy classification
columns and indexes remain untouched; new rows in legacy tables use empty strings
for required classification columns. Old classification scores remain in stored
metadata; the application does not interpret them. New databases have no classification
columns or indexes. Embedding identity/dimension validation is unchanged.

No automatic migration, deletion, or re-embedding occurs. Separate category database
files and user taxonomy YAML files are never opened or removed. You may retain them
as archives. If you want a clean schema, back up the original database and explicitly
index your source documents into a new `--db` path; keep the original until you have
verified retrieval. Re-indexing appends chunks, so avoid doing it into the original
unless duplicates are intended.

Historical ADRs describe earlier decisions; taxonomy-specific portions are superseded
by this simplified flow.

## Build

```bash
pnpm run build
```
