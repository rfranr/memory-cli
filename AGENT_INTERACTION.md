Next valuable steps would be:

[x] - add chunking before indexing, not whole-file embeddings only (decision documented in docs/adr/0001-chunking-before-indexing.md)
[x] - add tests around categoryEmbeddingText, metadata parsing, empty category DB, and chunking behavior (decision documented in docs/adr/0002-testing-strategy.md)
[ ] - add a rag-cli inspect / stats command
[ ] - improve README with a “what problem this solves” section
[ ] - maybe rename “RAG” slightly, because right now it is more local semantic index + taxonomy classifier than full RAG
