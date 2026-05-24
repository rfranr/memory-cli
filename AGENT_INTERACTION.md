 Read AGENTS.md and scaffolded the RAG CLI architecture.

 Implemented:

 - src/domain/*
     - entities, command DTOs, ports/interfaces
 - src/application/*
     - index document use case
     - search documents use case
 - src/infrastructure/*
     - HTTP POST /embedding client
     - SQLite vector store using persisted JSON embeddings + cosine ranking
 - src/core/core.ts
     - app composition/root
 - src/cli/program.ts
     - rag-cli index <file>
     - rag-cli search <text>
 - src/config/config.ts
     - env/default config
 - src/shared/cosine.ts
 - tsconfig.json
 - updated package.json scripts/bin

 Validation passed:

 ```bash
   pnpm test
   pnpm build
   node dist/index.js --help
 ```

 Available CLI:

 ```bash
   rag-cli index ./doc.txt --category foo --taxonomy bar --metadata '{"key":"value"}'
   rag-cli search "query text" --limit 5
 ```

 Defaults:

 - DB: ./rag.sqlite
 - Embedding endpoint: http://localhost:3000/embedding

 Can override with:

 ```bash
   --db ./my.sqlite --embedding-url http://localhost:3000/embedding
 ```