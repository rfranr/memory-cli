# ADR 0001: Chunk documents before indexing

## Status

Accepted

## Context

The current indexing flow stores one embedding per input document/text:

```text
input file/text -> one embedding -> one row in documents database
```

This is simple, but it is not good enough for semantic search when documents are long or contain multiple topics.

Problems with whole-file embeddings:

- Search can only return the full document, not the most relevant paragraph.
- A long document embedding mixes unrelated topics into one vector.
- Classification can be too broad if different parts of the document belong to different categories.
- Metadata cannot point to the exact location of a match inside the original document.

RAG-CLI’s purpose is to return the best scoring paragraphs/document texts with metadata such as category, filename, URL, section, or location. Chunking fits this purpose better than whole-file indexing.

## Decision

RAG-CLI will chunk content before indexing.

The `index` command will split the input text/file into chunks and store each chunk as a separate row in the documents database.

Chosen initial strategy:

1. Split by paragraphs first.
2. Ignore empty chunks.
3. If a paragraph is too large, split it further by character/token-ish size.
4. Embed each chunk independently.
5. Classify each chunk independently against the already-synced categories database.
6. Store each chunk independently in the documents database.
7. Add automatic chunk metadata.

Automatic metadata should include at least:

```json
{
  "chunkIndex": 0,
  "chunkCount": 10,
  "chunkStart": 0,
  "chunkEnd": 523
}
```

User metadata is preserved and copied into every chunk:

```json
{
  "fileName": "assets/docs/doc.txt",
  "url": "https://example.com/article"
}
```

Stored metadata for each indexed chunk should therefore include:

- user metadata
- chunk location metadata
- selected category metadata
- category score

## Classification decision

Each chunk will be classified independently.

Alternative considered: classify the whole document once and apply the same category to every chunk.

That alternative is faster and cheaper, but less accurate for documents containing multiple topics. Since RAG-CLI is meant to return precise text occurrences, independent chunk classification is the better default.

## Consequences

Positive:

- Search returns more precise results.
- Results can point to a paragraph or location instead of a whole file.
- Mixed-topic documents are handled better.
- Category metadata is more accurate per result.

Negative:

- Indexing creates more embeddings.
- Indexing is slower and costs more calls to the embedding endpoint.
- The documents database grows faster.
- The CLI must report multiple inserted rows instead of one document id.

## CLI impact

Current command shape can remain:

```bash
rag-cli index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
```

But the output should change from one id:

```json
{ "id": 1 }
```

to a chunk-aware result:

```json
{
  "chunks": 3,
  "ids": [1, 2, 3]
}
```

Search output already works conceptually because each stored row can represent one chunk.

## Implementation notes

Suggested additions:

- Add a `ChunkTextUseCase` or shared chunking utility.
- Add a `DocumentChunkInput` type with:
  - content
  - chunkIndex
  - chunkCount
  - chunkStart
  - chunkEnd
- Change `IndexDocumentUseCase.execute` to return inserted ids or a summary object.
- Keep the documents database table mostly unchanged because it already stores rows with `content`, `embedding_json`, and `metadata_json`.
- Ensure existing search behavior remains sorted by similarity score descending.

## Open follow-ups

- Decide default max chunk size.
- Decide if there should be overlap between large chunks.
- Add CLI options later if needed:

```bash
--chunk-size 1200
--chunk-overlap 150
--no-chunk
```

Default should remain chunking enabled once implemented.
