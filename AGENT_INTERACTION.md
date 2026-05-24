Next valuable steps would be:

[x] - add chunking before indexing, not whole-file embeddings only (decision documented in docs/adr/0001-chunking-before-indexing.md)
[x] - add tests around categoryEmbeddingText, metadata parsing, empty category DB, and chunking behavior (decision documented in docs/adr/0002-testing-strategy.md)
[x] - add a progress indicator when indexing a document and when sync/add categories (decision documented in docs/adr/0003-progress-indicators.md)
[x] - add a rag-cli inspect / stats command (decision documented in docs/adr/0004-inspect-stats-command.md)
[x] - add simple filtering/query support for indexed documents and chunks (file/text/category filters; decision documented in docs/adr/0005-find-command.md)
[x] - replace in-memory cosine scan with sqlite-vec KNN search for indexed chunks (decision documented in docs/adr/0006-sqlite-vec-knn.md)
[ ] - add support for multiple embedding models (e.g. text-embedding-3-small, text-embedding-3-large, etc.) and allow users to specify which model to use when indexing and querying
