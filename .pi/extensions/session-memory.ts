import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const OUTPUT_DIR = join(homedir(), '.local/share/pi-memory/sessions');
const LOG_FILE = '/tmp/pi-memory-index.log';

type PiMessage = {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }>;
};

type PiRecord = {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: PiMessage;
};

function messageText(content: PiMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }

  return (content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n');
}

function conversationRecord(record: PiRecord): boolean {
  return record.type === 'message' && (record.message?.role === 'user' || record.message?.role === 'assistant');
}

function formatRecord(record: PiRecord): string {
  const role = record.message?.role;

  return `[${record.timestamp ?? 'unknown'}] ${role?.toUpperCase()} (id: ${record.id ?? 'unknown'})`;
}

function extractConversation(sessionFile: string): string {
  const raw = readFileSync(sessionFile, 'utf8');
  const output: string[] = [`SOURCE: ${sessionFile}`];

  const records = raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as PiRecord);

  for (const record of records.filter(conversationRecord)) {
    const text = messageText(record.message?.content);

    if (!text.trim()) {
      continue;
    }

    output.push('', formatRecord(record), text);
  }

  return output.length > 1 ? output.join('\n') : '';
}

function resolveMemoryCli(projectRoot: string) {
  const localCli = join(projectRoot, 'node_modules/.bin/memory-cli');

  if (existsSync(localCli)) {
    return { command: localCli, args: [] as string[] };
  }

  const ownCli = join(projectRoot, 'dist/index.js');

  if (basename(projectRoot) === 'memory-cli' && existsSync(ownCli)) {
    return { command: process.execPath, args: [ownCli] };
  }

  return { command: 'memory-cli', args: [] as string[] };
}

const inFlight = new Map<string, Promise<void>>();

async function indexSession(sessionFile: string, projectRoot: string): Promise<void> {
  if (!existsSync(sessionFile)) {
    return;
  }
  const cleanText = extractConversation(sessionFile);

  if (!cleanText) {
    return;
  }

  const cli = resolveMemoryCli(projectRoot);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputFile = join(OUTPUT_DIR, `${basename(sessionFile, '.jsonl')}.txt`);

  writeFileSync(outputFile, cleanText, 'utf8');
  const log = openSync(LOG_FILE, 'a');

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        cli.command,
        [
          ...cli.args,
          'index',
          outputFile,
          '--metadata',
          JSON.stringify({
            type: 'session',
            project: basename(projectRoot),
            originalSession: sessionFile,
          }),
        ],
        {
          cwd: projectRoot,
          env: { ...process.env, MEMORY_CLI_ACTOR: 'pi', MEMORY_CLI_SESSION: basename(sessionFile, '.jsonl') },
          stdio: ['ignore', log, log],
        },
      );

      child.once('error', reject);
      child.once('close', (code, signal) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`memory-cli exited with ${signal ?? code}; check CLI/Ollama configuration and ${LOG_FILE}`));
        }
      });
    });
  } finally {
    closeSync(log);
  }
}

async function rememberSession(sessionFile: string | undefined, ctx: ExtensionContext) {
  if (!sessionFile) {
    return;
  }
  const existing = inFlight.get(sessionFile);

  if (existing) {
    return existing;
  }
  const operation = indexSession(sessionFile, ctx.cwd).catch((error: unknown) => {
    const message = `Session memory indexing failed: ${String(error)}`;

    console.error(message);
    ctx.ui.notify(message, 'error');
  });

  inFlight.set(sessionFile, operation);
  try {
    await operation;
  } finally {
    inFlight.delete(sessionFile);
  }
}

export default function (pi: ExtensionAPI) {
  pi.on('session_start', async (event, ctx) => {
    if (event.reason === 'new') {
      await rememberSession(event.previousSessionFile, ctx);
    }
  });
  pi.on('session_shutdown', async (event, ctx) => {
    // Reload and replacement shutdowns must not index the current session.
    if (event.reason === 'quit') {
      await rememberSession(ctx.sessionManager.getSessionFile(), ctx);
    }
  });
}
