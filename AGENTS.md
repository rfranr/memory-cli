# RAG-CLI Project Instructions

RAG-CLI is a TypeScript command-line tool for local document indexing and semantic search.

## Architecture

Documents → Chunks → Embeddings → Vector Store → Search

- `assets/docs` contains example user documents.
- Indexing reads text, files, or URLs, chunks content, embeds each chunk, and stores it with source and metadata.
- Search embeds the query and searches document vectors, returning chunks sorted by descending similarity.
- Preserve user metadata and `chunkIndex`, `chunkCount`, `chunkStart`, and `chunkEnd`.
- No taxonomy initialization, category synchronization, or classification is required or supported.
- Do not add concept extraction, knowledge graphs, or alternative classification systems.

## Compatibility

Do not silently delete or modify user data. Legacy classification fields remain in existing SQLite files for compatibility; new databases omit them. Category databases and user YAML files are unused and must not be deleted automatically. See README.md for compatibility details.

## Existing capabilities to preserve

- Embedding generation via the configured endpoint, including `POST /embedding`.
- Existing embedding model and chunking strategy.
- Local SQLite/sqlite-vec persistence and bundled CLI output.
- Source references, arbitrary user metadata, dry runs, find filters, and stats.

## Development requirements

- Inspect `./src` for comments and existing conventions before changing code.
- Keep changes minimal and focused on local-first indexing and semantic retrieval.
- Add tests for new features and functionality.
- Update README.md when necessary.

## Quality verification

After modifying application or test code:

1. Load the `quality-gates` skill.
2. Run the relevant quality checks.
3. Fix blocking violations without weakening quality policies.
4. Run existing tests, typecheck, and build.
5. Report results and any checks not executed.

Do not run quality gates for documentation-only changes unless relevant.
