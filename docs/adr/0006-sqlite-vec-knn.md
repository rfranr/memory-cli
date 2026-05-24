# ADR 0006: Replace in-memory cosine scan with sqlite-vec KNN search

## Status

Proposed

## Context

Current search implementation in `SqliteVectorStore.search()`:

- loads *all* rows from `documents`
- parses `embedding_json` for each row
- computes cosine similarity in JS
- sorts in memory and slices the top N

This is correct but does not scale:

- O(N) scan per query (CPU + JSON parse)
- high memory use for large databases
- slow for large numbers of chunks

RAG-CLI already depends on `sqlite-vec`, so we can move nearest-neighbor search into SQLite.

## Decision

Use `sqlite-vec` to perform KNN search inside SQLite for indexed chunks.

The documents database will store embeddings in a sqlite-vec index structure and search will become a SQL KNN query rather than a JS cosine scan.

## Proposed design

### Storage

Keep the existing `documents` table for content + metadata.

Add a sqlite-vec vector index table keyed by the `documents.id`.

Target shape (exact DDL depends on sqlite-vec API, but the *relational contract* must hold):

- `documents` table keeps:
  - `id` (INTEGER PRIMARY KEY)
  - `source`, `content`, `category`, `taxonomy`, `description`, `metadata_json`
  - optionally keep `embedding_json` only as a dev/debug artifact (see below)
- `documents_vec` table stores:
  - `rowid` = `documents.id`
  - `embedding` = vector column (fixed dimension; not JSON)

Hard requirement:

- inserts must be atomic: insert into `documents` + insert into `documents_vec` **in the same transaction**
- `documents_vec.rowid` must equal the inserted `documents.id`

This prevents orphan rows that are not retrievable through KNN.

### Query

Search becomes:

1. embed query text -> vector
2. execute KNN in SQLite:

   - `SELECT rowid, distance FROM documents_vec ORDER BY distance LIMIT ?`
   - add a stable tiebreaker: `ORDER BY distance, rowid`

3. join to `documents` on `documents.id = documents_vec.rowid`
4. return matched chunks + metadata

### Score contract

Current output score is a JS cosine similarity (higher is better).

sqlite-vec will typically produce a **distance** (lower is better). ADR must choose one:

- **Option A (recommended for minimal change):** return `distance` as `score` and document that lower is better
- **Option B:** convert distance -> similarity (requires defining metric + formula)

If sqlite-vec supports cosine similarity directly, keep cosine ordering.

Until metric support is confirmed, treat the score contract as an explicit design decision during implementation.

## Dimension/model handling

sqlite-vec requires a fixed vector dimension per index.

Rules:

- one embedding model+dimension per documents DB
- the DB must persist and enforce:
  - `embedding_model`
  - `embedding_dimensions`

This repository already uses an `index_metadata(key,value)` table. For sqlite-vec search/indexing we must enforce:

- `index_metadata.embedding_dimensions` matches the vec index dimension
- query embeddings must have the same dimension; otherwise fail with a clear error

Multi-model support (multiple vec tables or multiple DBs) is handled by a separate ADR/task.

## No migration plan (by design)

This change is treated as a clean break.

- No backfill and no fallback JS scan.
- Existing databases that do not have the vec index are incompatible.
- Users recreate the documents database if needed.

## `embedding_json` policy

Current state stores embeddings as JSON (`embedding_json`). sqlite-vec will not use JSON.

Policy:

- **Production path:** embeddings are stored only in the sqlite-vec structure.
- **Optional dev/debug:** `embedding_json` may be kept temporarily to validate correctness and inspect data.

If `embedding_json` is kept, it must be treated as non-authoritative and removable without affecting KNN search.

## Consequences

Positive:

- KNN search is much faster and scales better.
- Avoids loading/parsing all embeddings per query.
- Search becomes a database concern with indexes.

Negative:

- Requires schema changes.
- Requires fixed embedding dimension per DB.
- Ties search behavior more closely to sqlite-vec API constraints.
- Score semantics may change depending on sqlite-vec metric support (distance vs similarity).

## Implementation notes

- Update `SqliteVectorStore.init()` to:
  - enable/load sqlite-vec extension
  - create the vec table
  - validate `index_metadata` (model + dimensions)
- Update `add()` to:
  - insert into `documents`
  - insert into `documents_vec` using `rowid = documents.id`
  - do both inserts in a transaction
- Replace `search()` with a KNN SQL query + join:
  - `ORDER BY distance, rowid` for stable ordering
- Add tests that:
  - index a few chunks
  - query and verify ordering / limiting
  - ensure dimension mismatch fails clearly
  - ensure `documents` and `documents_vec` stay consistent (no orphans)

## Open questions

- Exact sqlite-vec table DDL and query syntax for KNN (depends on sqlite-vec version).
- Distance metric (cosine vs L2) supported by sqlite-vec and how it maps to our current cosine scoring.
- How to expose a stable score in output (distance -> similarity mapping).
