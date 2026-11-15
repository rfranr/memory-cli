import { documentIdentity } from '../../application/read-input.js';
import { randomUUID } from 'node:crypto';
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

export interface TraceFilter {
  project?: string;
  operation?: string;
  since?: string;
  until?: string;
  after?: number;
  limit?: number;
}

export interface TraceEvent {
  sequence?: number;
  id: string;
  timestamp: string;
  operation: string;
  status: string;
  project: string | null;
  actor: string;
  session: string | null;
  durationMs: number;
  count: number | null;
  memoryIds: string[];
}

export class Observability {
  constructor(private readonly filename: string) {}

  private async connect(): Promise<Database> {
    const db = await open({ filename: this.filename, driver: sqlite3.Database });

    await db.exec(`CREATE TABLE IF NOT EXISTS operation_traces (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
      timestamp TEXT NOT NULL, operation TEXT NOT NULL, status TEXT NOT NULL,
      project TEXT, actor TEXT NOT NULL, session TEXT, durationMs REAL NOT NULL,
      count INTEGER, memoryIds TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS traces_time ON operation_traces(timestamp);`);

    return db;
  }

  async record(event: Omit<TraceEvent, 'id'>): Promise<void> {
    const db = await this.connect();

    try {
      await db.run(
        `INSERT INTO operation_traces
        (id,timestamp,operation,status,project,actor,session,durationMs,count,memoryIds)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        randomUUID(),
        event.timestamp,
        event.operation,
        event.status,
        event.project,
        event.actor,
        event.session,
        event.durationMs,
        event.count,
        JSON.stringify(event.memoryIds),
      );
      await db.run(`DELETE FROM operation_traces WHERE sequence NOT IN
        (SELECT sequence FROM operation_traces ORDER BY sequence DESC LIMIT 10000)`);
    } finally {
      await db.close();
    }
  }

  async traces(filter: TraceFilter = {}): Promise<TraceEvent[]> {
    const db = await this.connect();
    const project = filter.project ?? null;
    const operation = filter.operation ?? null;
    const since = filter.since ?? null;
    const until = filter.until ?? null;

    try {
      const rows = await db.all(
        `SELECT * FROM operation_traces
        WHERE (? IS NULL OR project = ?) AND (? IS NULL OR operation = ?)
        AND (? IS NULL OR timestamp >= ?) AND (? IS NULL OR timestamp <= ?)
        AND sequence > ? ORDER BY sequence DESC LIMIT ?`,
        project,
        project,
        operation,
        operation,
        since,
        since,
        until,
        until,
        filter.after ?? 0,
        Math.min(10000, Math.max(1, filter.limit ?? 30)),
      );

      return rows.map((row) => ({ ...row, memoryIds: JSON.parse(row.memoryIds) }));
    } finally {
      await db.close();
    }
  }

  async sourceContext(identity: string): Promise<{ count: number; project?: string }> {
    const db = await this.connect();

    try {
      const rows = await db.all<Array<{ source: string; metadata_json: string }>>(
        'SELECT source, metadata_json FROM documents',
      );
      const matches = rows.filter((row) => documentIdentity(row.source) === identity);
      const projects = new Set(matches.map((row) => JSON.parse(row.metadata_json).project));
      const project = projects.size === 1 ? [...projects][0] : undefined;

      return { count: matches.length, project: typeof project === 'string' ? project : undefined };
    } finally {
      await db.close();
    }
  }

  async cleanup(before: string): Promise<number> {
    const db = await this.connect();

    try {
      return (await db.run('DELETE FROM operation_traces WHERE timestamp < ?', before)).changes ?? 0;
    } finally {
      await db.close();
    }
  }

  async inventory(project?: string): Promise<unknown> {
    const db = await this.connect();

    try {
      const memories = await db.all(
        `SELECT id, project FROM memories WHERE (? IS NULL OR project = ?)`,
        project ?? null,
        project ?? null,
      );
      const documents = await db.all(
        `SELECT source, metadata_json FROM documents
        WHERE (? IS NULL OR json_extract(metadata_json, '$.project') = ?)`,
        project ?? null,
        project ?? null,
      );
      const metadata = documents.map((row) => JSON.parse(row.metadata_json));
      const events = await this.traces({ project, limit: 10000 });
      const recent = events.filter((event) => event.timestamp >= new Date(Date.now() - 86400000).toISOString());
      const retrievals = memories.map((memory) => ({
        ...memory,
        retrievals: events.filter(
          (event) => event.operation === 'search' && event.status === 'success' && event.memoryIds.includes(memory.id),
        ).length,
      }));

      return {
        explicitMemories: memories.length,
        episodicSessions: new Set(
          metadata.filter((item) => item.type === 'session').map((item) => item.originalSession),
        ).size,
        indexedDocuments: new Set(documents.map((row) => row.source)).size,
        chunks: documents.length,
        projects: [...new Set([...memories.map((row) => row.project), ...metadata.map((item) => item.project)])]
          .filter(Boolean)
          .map((name) => ({
            project: name,
            memories: memories.filter((row) => row.project === name).length,
            operations: events.filter((event) => event.project === name).length,
            chunks: metadata.filter((item) => item.project === name).length,
          })),
        recent24h: {
          reads: recent.filter((event) => event.operation === 'search').length,
          writes: recent.filter((event) => event.operation !== 'search').length,
          successes: recent.filter((event) => event.status === 'success').length,
          failures: recent.filter((event) => event.status === 'failure').length,
          averageDurationMs: recent.reduce((sum, event) => sum + event.durationMs, 0) / (recent.length || 1),
        },
        frequentlyRetrieved: retrievals
          .filter((row) => row.retrievals > 0)
          .sort((a, b) => b.retrievals - a.retrievals)
          .slice(0, 10),
        neverRetrieved: retrievals.filter((row) => row.retrievals === 0),
        recentOperations: events.slice(0, 10),
        failuresAndSlow: events.filter((event) => event.status === 'failure' || event.durationMs >= 1000).slice(0, 10),
      };
    } finally {
      await db.close();
    }
  }
}
