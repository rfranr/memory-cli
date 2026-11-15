import type { Command } from 'commander';
import type { TraceEvent, TraceFilter } from '../infrastructure/database/observability.js';

export interface InspectionApp {
  traces(filter: TraceFilter): Promise<TraceEvent[]>;
  cleanupTraces(before: string): Promise<number>;
  dashboard(project?: string): Promise<unknown>;
}

interface DashboardData {
  explicitMemories: number;
  episodicSessions: number;
  indexedDocuments: number;
  chunks: number;
  recent24h: { reads: number; writes: number; failures: number; averageDurationMs: number };
  projects: { project: string; memories: number; chunks: number }[];
  recentOperations: TraceEvent[];
  frequentlyRetrieved: { id: string; retrievals: number }[];
  failuresAndSlow: TraceEvent[];
}

function eventLine(event: TraceEvent): string {
  return `${event.status === 'success' ? '✓' : '×'} ${event.operation} · ${event.project ?? '—'} · ${event.actor} · ${event.durationMs.toFixed(0)}ms`;
}

export function renderDashboard(
  value: unknown,
  tty = Boolean(process.stdout.isTTY),
  width = process.stdout.columns || 80,
): string {
  const data = value as DashboardData;
  const activity = data.recent24h;
  const lines = [
    `Memories ${data.explicitMemories} · Sessions ${data.episodicSessions}`,
    `Documents ${data.indexedDocuments} · Chunks ${data.chunks}`,
    '',
    'ACTIVITY · last 24h',
    `Reads ${activity.reads} · Writes ${activity.writes} · Failures ${activity.failures}`,
    `Average ${activity.averageDurationMs.toFixed(0)}ms`,
    '',
    'PROJECTS',
    ...data.projects.map((row) => `${row.project} · ${row.memories} memories · ${row.chunks} chunks`),
    '',
    'RECENT OPERATIONS',
    ...data.recentOperations.map(eventLine),
    '',
    'FREQUENT RETRIEVALS · not confirmed usefulness',
    ...data.frequentlyRetrieved.map((row) => `${row.id} · ${row.retrievals} retrievals`),
    '',
    'FAILURES / SLOW ≥1s',
    ...data.failuresAndSlow.map(eventLine),
    '',
    'Snapshot · run again to refresh',
  ];
  const title =
    tty && process.env.NO_COLOR === undefined
      ? '\u001b[36mMEMORY · local overview\u001b[0m'
      : 'MEMORY · local overview';

  return [title, '─'.repeat(Math.min(width, 80)), ...lines.map((line) => line.slice(0, Math.max(1, width)))].join('\n');
}

export function registerInspection(program: Command, app: () => Promise<InspectionApp>): void {
  program
    .command('dashboard')
    .option('--project <identifier>')
    .option('--json')
    .action(async (options: { project?: string; json?: boolean }) => {
      const value = await (await app()).dashboard(options.project);

      console.log(options.json ? JSON.stringify(value, null, 2) : renderDashboard(value));
    });
  program
    .command('traces')
    .option('--limit <number>', 'Maximum events', '30')
    .option('--project <identifier>')
    .option('--operation <name>')
    .option('--since <timestamp>')
    .option('--until <timestamp>')
    .option('--follow')
    .option('--json')
    .option('--cleanup-before <timestamp>', 'Delete traces only, before this ISO timestamp')
    .action(async (options) => {
      const instance = await app();

      if (options.cleanupBefore) {
        console.log(JSON.stringify({ deleted: await instance.cleanupTraces(validTime(options.cleanupBefore)) }));

        return;
      }
      const filter = parseFilter(options);
      let after = 0;
      const show = async () => {
        const rows = await instance.traces({ ...filter, after, ...(after ? { limit: 10000 } : {}) });

        for (const row of rows.reverse()) {
          printTrace(row, options.json);
          after = Math.max(after, row.sequence ?? 0);
        }
      };

      await show();

      if (options.follow) {
        while (!process.exitCode) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await show();
        }
      }
    });
}

function validTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp');
  }

  return date.toISOString();
}

function parseFilter(options: TraceFilter): TraceFilter {
  const filter = { ...options, limit: Number(options.limit) };

  if (!Number.isInteger(filter.limit) || filter.limit < 1) {
    throw new Error('Invalid limit');
  }
  if (filter.since) {
    filter.since = validTime(filter.since);
  }
  if (filter.until) {
    filter.until = validTime(filter.until);
  }

  return filter;
}

function printTrace(row: TraceEvent, json: boolean): void {
  console.log(
    json
      ? JSON.stringify(row)
      : `${row.timestamp} ${eventLine(row)} · session ${row.session ?? '—'} [${row.memoryIds.join(',')}]`,
  );
}
