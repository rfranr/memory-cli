import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('indexes new and quit via the real CLI, reuses unchanged embeddings, and handles endpoint failure', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pi-memory-'));
  const saved = { ...process.env };
  let requests = 0;
  const server = createServer(async (req, res) => {
    let body = '';

    for await (const chunk of req) {
      body += chunk;
    }
    requests++;
    const { input } = JSON.parse(body);

    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ embeddings: input.map(() => [1, 0]) }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    Object.assign(process.env, {
      HOME: dir,
      RAG_CLI_DB: join(dir, 'memory.sqlite'),
      RAG_CLI_EMBEDDING_URL: `http://127.0.0.1:${server.address().port}/api/embed`,
      RAG_CLI_EMBEDDING_PROVIDER: 'ollama',
      RAG_CLI_EMBEDDING_MODEL: 'test',
      RAG_CLI_EMBEDDING_DIMENSIONS: '2',
    });
    const source = readFileSync('.pi/extensions/session-memory.ts', 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
    const { default: extension } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    const handlers = {};
    const diagnostics = [];
    const session = join(dir, 'session.jsonl');
    const ctx = {
      cwd: process.cwd(),
      sessionManager: { getSessionFile: () => session },
      ui: { notify: (message) => diagnostics.push(message) },
    };

    extension({
      on: (name, handler) => {
        handlers[name] = handler;
      },
    });
    writeFileSync(
      session,
      JSON.stringify({ type: 'message', message: { role: 'user', content: 'integration conversation' } }),
    );
    await handlers.session_start({ reason: 'new', previousSessionFile: session }, ctx);
    expect(requests).toBeGreaterThan(0);
    const first = requests;

    await handlers.session_shutdown({ reason: 'quit' }, ctx);
    expect(requests).toBe(first);
    writeFileSync(
      session,
      JSON.stringify({ type: 'message', message: { role: 'assistant', content: 'changed conversation' } }),
    );
    await handlers.session_shutdown({ reason: 'quit' }, ctx);
    expect(requests).toBeGreaterThan(first);
    expect(diagnostics).toEqual([]);
    await new Promise((resolve) => server.close(resolve));
    writeFileSync(
      session,
      JSON.stringify({ type: 'message', message: { role: 'user', content: 'unavailable endpoint' } }),
    );
    await handlers.session_shutdown({ reason: 'quit' }, ctx);
    expect(diagnostics).toEqual([expect.stringContaining('indexing failed')]);
  } finally {
    server.close();
    process.env = saved;
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);
