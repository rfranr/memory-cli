# ADR 0005: Add a simple `find` command for filtering indexed documents and chunks

## Status

Proposed

## Context

RAG-CLI currently supports:

- `categories sync` to populate the taxonomy database
- `index` to store chunked documents with category metadata
- `search` for embedding-based semantic retrieval
- `stats` / `inspect` for database inspection

However, there is still no easy way to inspect indexed content with simple, direct filters.

This is a problem when the user wants to answer questions like:

- “show me everything indexed from this file”
- “find chunks containing this text”
- “show documents in this category”

Embedding search is great for semantic retrieval, but it is not the best tool for these operational inspection tasks.

## Decision

Add a simple filtering/query command called `find`.

Initial supported forms should be:

```bash
rag-cli find --file machinelearning
rag-cli find --text pipeline
rag-cli find --category llms
```

The command should be read-only and should query the documents database directly.

## Expected behavior

### `--file`

Filter by source filename/path.

This returns indexed chunks whose `source` contains the provided value.

### `--text`

Filter by plain text content.

This returns chunks whose stored `content` contains the provided text.

### `--category`

Filter by stored category metadata.

V1 scope:

- exact or partial match on `category` id/name
- optional partial match on taxonomy path can be added later

## Match semantics (V1)

- matching is case-insensitive (`LIKE` with normalized/lowercased comparison)
- partial matching uses `%value%`
- when multiple filters are provided, combine with `AND`

## Pagination and limits (V1)

- `--limit <n>` supported (default: `20`)
- `--offset <n>` supported (default: `0`)

## Behavior with no filters

If no `--file`, `--text`, or `--category` is provided, the command should fail with a clear validation error:

```text
find requires at least one filter: --file, --text, or --category
```

## Output

The command should return JSON to stdout with result metadata and matches.

Example:

```json
{
  "total": 120,
  "limit": 20,
  "offset": 0,
  "matches": [
    {
      "id": 12,
      "source": "assets/docs/doc.txt",
      "content": "...",
      "taxonomy": {
        "category": "llms",
        "taxonomy": "Technology / AI / LLMs",
        "metadata": {
          "fileName": "doc.txt",
          "chunkIndex": 0
        }
      }
    }
  ]
}
```

## Minimal implementation

Start with a simple SQL-backed filtering layer over the documents database.

Suggested first version:

- `--file`: `LIKE` on `source`
- `--text`: `LIKE` on `content`
- `--category`: exact or `LIKE` on `category`
- combine filters with `AND`
- support `limit` + `offset`

## Safety and performance notes

- Use parameterized SQL queries only.
- Avoid manual SQL string interpolation with user input.
- `%...%` text filtering over large `content` fields may be slow on very large datasets; acceptable for V1 inspection use.

## Consequences

Positive:

- Easier debugging and inspection of indexed data.
- Useful without embeddings or semantic similarity.
- Helpful for verifying indexing behavior and metadata quality.
- A good stepping stone toward hybrid search.

Negative:

- Adds another command and query path.
- Requires a small SQL filtering API in the documents store.
- Needs careful CLI option design to avoid confusion with `search`.

## Future evolution

This command can later evolve into hybrid search by combining:

- direct filters
- semantic ranking
- metadata constraints
- category constraints

For now, the goal is simple inspection/filtering first.
