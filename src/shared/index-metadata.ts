import type sqlite3 from "sqlite3";
import type { Database } from "sqlite";

export type IndexMetadata = Record<string, string>;

export async function ensureIndexMetadata(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  metadata: IndexMetadata,
  label: string,
): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS index_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const rows = await db.all<Array<{ key: string; value: string }>>(`SELECT key, value FROM index_metadata`);

  if (rows.length === 0) {
    const entries = Object.entries(metadata);
    for (const [key, value] of entries) {
      await db.run(`INSERT INTO index_metadata (key, value) VALUES (?, ?)`, key, value);
    }
    return;
  }

  const existing = new Map(rows.map((row) => [row.key, row.value] as const));

  for (const [key, expected] of Object.entries(metadata)) {
    const actual = existing.get(key);
    if (actual === undefined) {
      throw new Error(`${label} metadata mismatch: missing key '${key}' in index_metadata`);
    }

    if (actual !== expected) {
      throw new Error(`${label} metadata mismatch for '${key}': expected '${expected}' but found '${actual}'`);
    }
  }
}
