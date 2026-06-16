import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config';

const here = dirname(fileURLToPath(import.meta.url));

export type DB = Database.Database;

/** Open (or create) a SQLite database and apply the schema. `:memory:` is used by tests. */
export function createDb(path: string = config.dbPath): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  return db;
}

let singleton: DB | null = null;

/** Process-wide database used by the running server. */
export function getDb(): DB {
  if (!singleton) singleton = createDb();
  return singleton;
}
