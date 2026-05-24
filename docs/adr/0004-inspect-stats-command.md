# ADR 0004: Add `rag-cli inspect` / `rag-cli stats` command

## Status

Accepted

## Context

RAG-CLI maintains two local SQLite databases:

- categories DB: embedded taxonomy categories
- documents DB: embedded document chunks with category + user metadata

As the CLI grows, users need visibility into what has been indexed/synced.

Current gaps:

- no way to know how many categories are synced
- no way to know how many documents/chunks are indexed
- no way to see basic distribution by category
- no way to confirm which DB files are being used (paths)

Without basic inspection, debugging common issues is harder:

- indexing returns unexpected categories
- search returns no results
- user points to the wrong DB file
- categories DB is empty or out of sync with `categories.yml`

## Decision

Add a read-only inspection command to report database statistics.

Command name:

- prefer `rag-cli stats` (short)
- optionally alias `rag-cli inspect`

The command must not require the embedding endpoint.

## Proposed CLI

### Top-level stats

```bash
rag-cli stats
```

Outputs JSON to stdout, for example:

```json
{
  "documentsDb": "./rag.sqlite",
  "categoriesDb": "./rag-categories.sqlite",
  "documents": {
    "chunks": 120,
    "sources": 8,
    "categories": 14
  },
  "categories": {
    "synced": 250
  }
}
```

### Optional breakdowns

Optional flags (can be phased in):

```bash
rag-cli stats --by category
rag-cli stats --top 20
```

Example breakdown:

```json
{
  "byCategory": [
    {"category": "software-architecture", "chunks": 42},
    {"category": "guitar", "chunks": 17}
  ]
}
```

## Implementation notes

- Add a `StatsUseCase` that reads from both DBs.
- Extend stores with minimal count/group queries:
  - categories: `SELECT count(*) FROM categories`
  - documents: `SELECT count(*) FROM documents`
  - documents by category: `SELECT category, count(*) FROM documents GROUP BY category`
  - documents distinct sources: `SELECT count(DISTINCT source) FROM documents`
- Keep it fast: avoid loading all rows into memory.

## Consequences

Positive:

- Better UX and debuggability.
- Clear feedback about DB state without running a search.
- Helps confirm that `categories sync` was executed.

Negative:

- Requires new store methods/queries.
- Needs stable JSON output contract.

## Open questions

- naming: `stats` vs `inspect`
- whether to include schema/version info
- whether to include last sync/update timestamps
