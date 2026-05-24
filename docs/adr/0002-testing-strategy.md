# ADR 0002: Add focused tests for taxonomy classification and chunk indexing

## Status

Proposed

## Context

RAG-CLI has moved beyond a simple CLI wrapper. It now contains important behavior in several layers:

- taxonomy YAML is transformed into text before embedding
- user metadata is parsed from CLI JSON
- the categories database must be synced before classification/indexing
- indexing chunks documents before persistence
- every chunk is embedded and classified independently
- search returns stored chunk content plus category and user metadata

Currently, `pnpm test` only runs TypeScript checks. Type checking catches structural errors, but it does not verify behavior.

This creates risk around regressions in classification quality, metadata persistence, CLI contracts, and indexing output.

## Decision

Add a focused automated test suite for the core behavior of the application.

Use a real test runner, preferably `vitest`, while keeping TypeScript type checking.

Suggested scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "tsc --noEmit && vitest run"
  }
}
```

Tests should avoid needing a live embedding server. Use fake embedding/category/vector stores for application use-case tests.

## Required test areas

### 1. Category embedding text

`categoryEmbeddingText` defines the text sent to the embedding endpoint for each taxonomy category.

Small formatting changes can affect classification behavior, so tests should verify that category embedding text contains:

- category id
- taxonomy path
- description when present
- examples when present

Example category:

```ts
{
  id: "software-architecture",
  path: "Tecnologia / Desenvolupament / Arquitectura",
  description: "Notes sobre disseny de software",
  examples: ["Clean Architecture", "DDD"]
}
```

The generated embedding text should be deterministic and include all relevant fields.

### 2. Metadata parsing

`--metadata` is user-facing and is copied into every indexed chunk.

Tests should verify:

- valid JSON object is accepted
- arrays are rejected
- strings/numbers/null are rejected
- invalid JSON fails clearly

This protects search result metadata because the metadata is persisted and returned to users.

### 3. Empty category database behavior

The intended workflow is:

```bash
rag-cli categories sync assets/taxonomy/categories.yml
rag-cli index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
```

If the user skips `categories sync`, indexing should fail clearly.

Expected error:

```text
Cannot index document: categories database is empty. Run `rag-cli categories sync <categories.yml>` first.
```

A test should ensure this remains a clear domain error, not an empty result or low-level SQLite/internal error.

### 4. Chunking behavior

Chunking is now core indexing behavior.

Tests for `chunkText` should cover:

- empty input returns no chunks
- whitespace-only input returns no chunks
- multiple paragraphs produce multiple chunks
- chunk indexes and counts are correct
- `chunkStart` and `chunkEnd` point to the original text
- long paragraphs split into smaller chunks

### 5. Indexing use case

`IndexDocumentUseCase` should be tested with fake dependencies.

Tests should verify:

- a multi-paragraph document inserts multiple chunks
- each chunk is embedded independently
- each chunk is classified independently
- result shape is `{ chunks, ids }`
- metadata includes:
  - user metadata
  - `chunkIndex`
  - `chunkCount`
  - `chunkStart`
  - `chunkEnd`
  - `categoryScore`

### 6. CLI behavior

Minimal CLI tests should verify:

- `index` prints `{ chunks, ids }`, not `{ id }`
- `classify` does not require `--taxonomy`
- `categories sync <taxonomy-file>` is the command responsible for reading taxonomy YAML

## Consequences

Positive:

- Safer refactors of classification and indexing behavior.
- Better confidence in CLI contracts.
- No live embedding server needed for most tests.
- Prevents regressions in chunk metadata and search result metadata.

Negative:

- Adds a test dependency.
- Requires some functions to remain testable/exported.
- Slightly slower `pnpm test` if typecheck and tests both run.

## Priority

Recommended implementation order:

1. unit tests for `chunkText`
2. unit tests for `categoryEmbeddingText`
3. metadata parsing tests
4. empty category DB behavior test
5. indexing use-case tests with fakes
6. minimal CLI contract tests
