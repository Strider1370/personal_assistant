import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createAssistantDatabase } from "../../src/db/sqlite.js";
import { syncApprovedNotionPages } from "../../src/notion/notion-sync.js";
import type { NotionPageSummary, NotionSyncClient } from "../../src/notion/notion-client.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assistant-notion-sync-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeApprovedPage(): NotionPageSummary {
  return {
    id: "page-1",
    lastEditedTime: "2026-06-08T11:00:00Z",
    properties: {
      title: "Approved Notion Draft",
      type: "idea",
      summary: "Brainstormed in ChatGPT and approved.",
      bullets: ["Keep approval explicit", "Sync through backend"],
      reflection: "This should sync exactly once.",
      tags: ["chatgpt", "notion"],
      source: "chatgpt",
      approvalStatus: "Approved",
      syncedToObsidian: false
    }
  };
}

describe("syncApprovedNotionPages", () => {
  test("syncs approved pages once and skips duplicate revision runs", async () => {
    const dir = await makeTempDir();
    const vaultPath = path.join(dir, "vault");
    const db = createAssistantDatabase(path.join(dir, "assistant.db"));
    const client: NotionSyncClient = {
      async listCandidatePages() {
        return [makeApprovedPage()];
      }
    };

    const first = await syncApprovedNotionPages({
      notionClient: client,
      database: db,
      vaultPath
    });
    const second = await syncApprovedNotionPages({
      notionClient: client,
      database: db,
      vaultPath
    });

    expect(first.saved).toHaveLength(1);
    expect(second.saved).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
    db.close();
  });

  test("rejects incomplete mapped data instead of guessing", async () => {
    const dir = await makeTempDir();
    const db = createAssistantDatabase(path.join(dir, "assistant.db"));
    const client: NotionSyncClient = {
      async listCandidatePages() {
        return [
          {
            ...makeApprovedPage(),
            properties: {
              ...makeApprovedPage().properties,
              summary: ""
            }
          }
        ];
      }
    };

    const result = await syncApprovedNotionPages({
      notionClient: client,
      database: db,
      vaultPath: path.join(dir, "vault")
    });

    expect(result.saved).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    db.close();
  });
});
