import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createAssistantDatabase } from "../../src/db/sqlite.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assistant-db-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createAssistantDatabase", () => {
  test("creates tables and keeps notion sync inserts idempotent", async () => {
    const dir = await makeTempDir();
    const db = createAssistantDatabase(path.join(dir, "assistant.db"));

    db.recordNotionSync({
      pageId: "page-1",
      revisionKey: "2026-06-08T10:00:00Z",
      notePath: "Inbox/first.md"
    });
    db.recordNotionSync({
      pageId: "page-1",
      revisionKey: "2026-06-08T10:00:00Z",
      notePath: "Inbox/first.md"
    });

    expect(db.hasNotionSync("page-1", "2026-06-08T10:00:00Z")).toBe(true);
    expect(db.countRows("notion_sync")).toBe(1);
    db.close();
  });

  test("tracks sent digest ids and note index entries", async () => {
    const dir = await makeTempDir();
    const db = createAssistantDatabase(path.join(dir, "assistant.db"));

    db.markDigestSent({
      source: "hacker_news",
      sourceId: "hn-1"
    });
    db.markDigestSent({
      source: "hacker_news",
      sourceId: "hn-1"
    });
    db.upsertNoteIndex({
      path: "Inbox/note.md",
      title: "Indexed note",
      type: "note",
      tags: ["ai", "agent"]
    });

    expect(db.hasSentDigest("hacker_news", "hn-1")).toBe(true);
    expect(db.countRows("sent_digests")).toBe(1);
    expect(db.findNotesByTags(["ai"])).toHaveLength(1);
    db.close();
  });
});
