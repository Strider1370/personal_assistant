import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { runMigrations } from "./migrations.js";

export type DigestSource = "geek_news" | "hacker_news" | "openai_blog" | "anthropic_blog";

export type NoteIndexEntry = {
  path: string;
  title: string;
  type: string;
  tags: string[];
};

export type NotionSyncRecord = {
  pageId: string;
  revisionKey: string;
  notePath: string;
};

export type AssistantDatabase = ReturnType<typeof createAssistantDatabase>;

export function createAssistantDatabase(databasePath: string) {
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  runMigrations(database);

  return {
    markSourceItemSeen(input: { source: DigestSource; sourceId: string }) {
      database
        .prepare(
          `
            INSERT INTO source_items (source, source_id)
            VALUES (?, ?)
            ON CONFLICT(source, source_id) DO NOTHING
          `
        )
        .run(input.source, input.sourceId);
    },

    hasSeenSourceItem(source: DigestSource, sourceId: string): boolean {
      const row = database
        .prepare("SELECT 1 FROM source_items WHERE source = ? AND source_id = ? LIMIT 1")
        .get(source, sourceId) as { 1: number } | undefined;
      return Boolean(row);
    },

    markDigestSent(input: { source: DigestSource; sourceId: string }) {
      database
        .prepare(
          `
            INSERT INTO sent_digests (source, source_id)
            VALUES (?, ?)
            ON CONFLICT(source, source_id) DO NOTHING
          `
        )
        .run(input.source, input.sourceId);
    },

    hasSentDigest(source: DigestSource, sourceId: string): boolean {
      const row = database
        .prepare("SELECT 1 FROM sent_digests WHERE source = ? AND source_id = ? LIMIT 1")
        .get(source, sourceId) as { 1: number } | undefined;
      return Boolean(row);
    },

    upsertNoteIndex(entry: NoteIndexEntry) {
      database
        .prepare(
          `
            INSERT INTO note_index (path, title, type, tags_json, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(path) DO UPDATE SET
              title = excluded.title,
              type = excluded.type,
              tags_json = excluded.tags_json,
              updated_at = CURRENT_TIMESTAMP
          `
        )
        .run(entry.path, entry.title, entry.type, JSON.stringify(entry.tags));
    },

    findNotesByTags(tags: string[]): NoteIndexEntry[] {
      if (tags.length === 0) {
        return [];
      }

      const rows = database
        .prepare("SELECT path, title, type, tags_json FROM note_index")
        .all() as Array<{ path: string; title: string; type: string; tags_json: string }>;

      return rows
        .map((row) => ({
          path: row.path,
          title: row.title,
          type: row.type,
          tags: JSON.parse(row.tags_json) as string[]
        }))
        .filter((row) => row.tags.some((tag) => tags.includes(tag)));
    },

    recordNotionSync(record: NotionSyncRecord) {
      database
        .prepare(
          `
            INSERT INTO notion_sync (page_id, revision_key, note_path)
            VALUES (?, ?, ?)
            ON CONFLICT(page_id, revision_key) DO NOTHING
          `
        )
        .run(record.pageId, record.revisionKey, record.notePath);
    },

    hasNotionSync(pageId: string, revisionKey: string): boolean {
      const row = database
        .prepare("SELECT 1 FROM notion_sync WHERE page_id = ? AND revision_key = ? LIMIT 1")
        .get(pageId, revisionKey) as { 1: number } | undefined;
      return Boolean(row);
    },

    recordJobRun(jobName: string, status: "started" | "succeeded" | "failed", details?: unknown) {
      database
        .prepare(
          `
            INSERT INTO jobs (job_name, status, details_json)
            VALUES (?, ?, ?)
          `
        )
        .run(jobName, status, details ? JSON.stringify(details) : null);
    },

    countRows(tableName: "source_items" | "sent_digests" | "note_index" | "notion_sync" | "jobs") {
      const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as {
        count: number;
      };

      return row.count;
    },

    getDatabase() {
      return database;
    },

    close() {
      database.close();
    }
  };
}
