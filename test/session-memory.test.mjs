import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  openSync: vi.fn(() => 42),
  closeSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('node:fs', () => mocks);
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
import extension from '../.pi/extensions/session-memory.ts';

let handlers;
let ctx;
let child;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.existsSync.mockReturnValue(true);
  mocks.readFileSync.mockReturnValue(
    [
      { type: 'session' },
      { type: 'message', message: { role: 'user', content: 'hello' } },
      {
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', text: 'secret' },
            { type: 'text', text: 'world' },
          ],
        },
      },
      { type: 'message', message: { role: 'toolResult', content: 'tool secret' } },
    ]
      .map(JSON.stringify)
      .join('\n'),
  );
  child = new EventEmitter();
  mocks.spawn.mockReturnValue(child);
  handlers = {};
  ctx = { cwd: '/project', sessionManager: { getSessionFile: () => '/session.jsonl' }, ui: { notify: vi.fn() } };
  extension({
    on: (name, handler) => {
      handlers[name] = handler;
    },
  });
});

it.each(['new', 'quit'])('awaits indexing on %s and extracts only conversation text', async (reason) => {
  const event = { reason, previousSessionFile: '/session.jsonl' };
  const handler = handlers[reason === 'new' ? 'session_start' : 'session_shutdown'];
  let finished = false;
  const pending = handler(event, ctx).then(() => {
    finished = true;
  });

  await Promise.resolve();
  expect(finished).toBe(false);
  expect(mocks.spawn).toHaveBeenCalledOnce();
  const text = mocks.writeFileSync.mock.calls[0][1];

  expect(text).toContain('hello');
  expect(text).toContain('world');
  expect(text).not.toContain('secret');
  expect(mocks.spawn.mock.calls[0][1]).toContain(
    JSON.stringify({
      type: 'session',
      project: 'project',
      originalSession: '/session.jsonl',
    }),
  );
  child.emit('close', 0, null);
  await pending;
  expect(ctx.ui.notify).not.toHaveBeenCalled();
});

it.each(['new', 'quit'])('skips empty sessions on %s', async (reason) => {
  mocks.readFileSync.mockReturnValue('{"type":"session"}\n');
  await handlers[reason === 'new' ? 'session_start' : 'session_shutdown'](
    { reason, previousSessionFile: '/session.jsonl' },
    ctx,
  );
  expect(mocks.spawn).not.toHaveBeenCalled();
});

it('ignores both reload events and missing session files', async () => {
  await handlers.session_shutdown({ reason: 'reload' }, ctx);
  await handlers.session_start({ reason: 'reload' }, ctx);
  mocks.existsSync.mockReturnValue(false);
  await handlers.session_shutdown({ reason: 'quit' }, ctx);
  expect(mocks.spawn).not.toHaveBeenCalled();
});

it('shares concurrent indexing and reports nonzero CLI failures', async () => {
  const first = handlers.session_shutdown({ reason: 'quit' }, ctx);
  const second = handlers.session_shutdown({ reason: 'quit' }, ctx);

  expect(mocks.spawn).toHaveBeenCalledOnce();
  child.emit('close', 1, null);
  await Promise.all([first, second]);
  expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('CLI/Ollama'), 'error');
  expect(mocks.closeSync).toHaveBeenCalledWith(42);
});

it('reports unavailable CLI and spawn errors without rejecting shutdown', async () => {
  mocks.existsSync.mockImplementation((path) => path === '/session.jsonl');
  await handlers.session_shutdown({ reason: 'quit' }, ctx);
  expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining('memory-cli unavailable'), 'error');
  mocks.existsSync.mockReturnValue(true);
  const pending = handlers.session_shutdown({ reason: 'quit' }, ctx);

  child.emit('error', new Error('ENOENT'));
  await pending;
  expect(ctx.ui.notify).toHaveBeenLastCalledWith(expect.stringContaining('ENOENT'), 'error');
});
