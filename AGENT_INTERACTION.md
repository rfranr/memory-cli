Next valuable steps would be:

[x] - add chunking before indexing, not whole-file embeddings only (decision documented in docs/adr/0001-chunking-before-indexing.md)
[x] - add tests around categoryEmbeddingText, metadata parsing, empty category DB, and chunking behavior (decision documented in docs/adr/0002-testing-strategy.md)
[x] - add a progress indicator when indexing a document and when sync/add categories (decision documented in docs/adr/0003-progress-indicators.md)
[x] - add a rag-cli inspect / stats command (decision documented in docs/adr/0004-inspect-stats-command.md)
[ ] - improve README with a “what problem this solves” section
[ ] - maybe rename “RAG” slightly, because right now it is more local semantic index + taxonomy classifier than full RAG
