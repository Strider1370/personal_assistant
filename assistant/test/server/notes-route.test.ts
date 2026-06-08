import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { buildApp } from "../../src/server/app.js";
import type { AppConfig } from "../../src/shared/config.js";
import type { StructuredNoteDraft } from "../../src/notes/note-schema.js";

const tempDirs: string[] = [];

async function makeVault(): Promise<string> {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "assistant-notes-route-"));
  tempDirs.push(vaultPath);
  return vaultPath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const validDraft: StructuredNoteDraft = {
  type: "idea",
  title: "Route Save",
  summary: "Route saves a note.",
  bullets: ["Validate input", "Render markdown", "Write note"],
  tags: ["api"],
  relatedNoteHints: [],
  source: "manual",
  createdAt: "2026-06-08T09:00:00Z"
};

function makeConfig(vaultPath: string): AppConfig {
  return {
    obsidianVaultPath: vaultPath,
    assistantPort: 3010,
    assistantDbPath: path.join(vaultPath, "assistant.db"),
    llmProvider: "alibaba",
    llmBaseUrl: "https://example.com/v1",
    llmApiKey: "test-key",
    llmModel: "deepseek-v4-flash",
    llmEnableThinking: false,
    notionToken: "test-notion-token",
    notionDatabaseId: "test-notion-db",
    telegramBotToken: "test-telegram-token",
    telegramChatId: "12345",
    digestTimezone: "Asia/Seoul"
  };
}

describe("POST /notes/save", () => {
  test("returns 400 for invalid payload", async () => {
    const app = buildApp({
      ...makeConfig(await makeVault())
    });

    const response = await app.inject({
      method: "POST",
      url: "/notes/save",
      payload: {
        title: "missing fields"
      }
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  test("returns ok true and filename for valid payload", async () => {
    const app = buildApp({
      ...makeConfig(await makeVault())
    });

    const response = await app.inject({
      method: "POST",
      url: "/notes/save",
      payload: validDraft
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.filename).toBe("2026-06-08-route-save.md");
    expect(typeof body.path).toBe("string");
    await app.close();
  });
});
