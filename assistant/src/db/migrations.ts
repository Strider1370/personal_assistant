import type { DatabaseSync } from "node:sqlite";

export function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS source_items (
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (source, source_id)
    );

    CREATE TABLE IF NOT EXISTS sent_digests (
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (source, source_id)
    );

    CREATE TABLE IF NOT EXISTS note_index (
      path TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notion_sync (
      page_id TEXT NOT NULL,
      revision_key TEXT NOT NULL,
      note_path TEXT NOT NULL,
      synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (page_id, revision_key)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      status TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
