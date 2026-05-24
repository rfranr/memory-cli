# RAG-CLI Project Instructions

RAG-CLI is a TypeScript command-line tool for local taxonomy-based classification, document indexing, and semantic search using embeddings.

## Source of truth

`categories.yml` is the source of truth for categories.

- The user owns and defines this taxonomy file.
- Example: `assets/taxonomy/categories.yml`.
- The application must follow the YAML format used by that file.
- Categories are not invented by the system; they come from the user taxonomy.

Think of the project folders as:

```text
assets/taxonomy -> user-defined categories/taxonomy source of truth
assets/docs     -> texts, paragraphs, or documents the user wants to index/query
```

## Databases

RAG-CLI uses two logical databases/indexes.

### 1. Categories database

Purpose: store embeddings for the user-defined taxonomy categories.

Population flow:

```bash
rag-cli categories sync assets/taxonomy/categories.yml
```

This command:

1. Reads the user-provided `categories.yml` file.
2. Creates an embedding for every taxonomy/category entry.
3. Upserts those category embeddings and taxonomy metadata into the categories database.

Important: do not classify documents by passing `--taxonomy` to `classify`. The taxonomy is synced first, then reused from the categories database.

### 2. Documents database

Purpose: store searchable user content.

With the `index` command, the user provides a paragraph, string, or text document plus arbitrary metadata.

```bash
rag-cli index assets/docs/doc.txt --metadata '{"fileName":"assets/docs/doc.txt"}'
```

Indexing behavior:

1. Accept a paragraph/string/text document.
2. Accept metadata from the user.
3. Classify the content using the already-synced category embeddings from the categories database.
4. Store the content embedding in the documents database.
5. Store metadata with the indexed content.

Stored document metadata should include:

- selected category id/path/description
- classification score
- user-provided location metadata, for example filename, URL, section, page, or anything else

## Optional classification check

A classify command may classify a text/file against the existing categories database:

```bash
rag-cli classify assets/docs/doc.txt
```

It must not require `--taxonomy`; taxonomy loading belongs to `categories sync`.

## Query/search behavior

When the user queries the system:

1. Embed the query text.
2. Search the documents database, not the categories database.
3. Return the highest scoring paragraphs/document texts.
4. Include all stored metadata in results.

Search results should return content plus metadata such as:

- category
- taxonomy path
- filename
- URL
- location
- any other user-provided metadata

## Existing capabilities to preserve

- Use `POST /embedding` to create embeddings.
- Persist embeddings and metadata locally.
- Return results sorted from highest similarity score to lowest score.

## Technical dependencies

- TypeScript
- SQLite and/or sqlite-vec
- Bundled CLI output

## Development requirements

- Inspect `./src` for comments and existing conventions before changing code.
- Keep the CLI focused on local-first taxonomy classification, indexing, and semantic search.
- Add tests for new features and functionality. 
- Update documentation in the README.md when necessary.