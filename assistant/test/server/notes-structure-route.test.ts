import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { buildApp } from "../../src/server/app.js";
import type { AppConfig } from "../../src/shared/config.js";
import type { StructuredNoteDraft } from "../../src/notes/note-schema.js";
import type { NoteStructureModelClient } from "../../src/llm/model-client.js";

const tempDirs: string[] = [];

async function makeVault(): Promise<string> {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "assistant-structure-route-"));
  tempDirs.push(vaultPath);
  return vaultPath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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

function makeFakeModelClient(draft: StructuredNoteDraft): NoteStructureModelClient {
  return {
    async structureRawNote(rawInput) {
      return {
        draft: {
          ...draft,
          rawInput
        }
      };
    }
  };
}

describe("POST /notes/structure", () => {
  test("returns 400 for invalid payload", async () => {
    const app = buildApp(makeConfig(await makeVault()), {
      modelClient: makeFakeModelClient({
        type: "idea",
        title: "unused",
        summary: "unused",
        bullets: ["unused"],
        tags: [],
        relatedNoteHints: [],
        source: "llm",
        createdAt: "2026-06-08T10:00:00Z"
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/notes/structure",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  test("returns a structured draft without saving by default", async () => {
    const app = buildApp(makeConfig(await makeVault()), {
      modelClient: makeFakeModelClient({
        type: "idea",
        title: "Structured by model",
        summary: "A clean summary.",
        bullets: ["Point one", "Point two"],
        tags: ["ai"],
        relatedNoteHints: ["knowledge-base"],
        source: "llm",
        createdAt: "2026-06-08T10:00:00Z"
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/notes/structure",
      payload: {
        rawInput: "messy note text"
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.saved).toBe(false);
    expect(body.draft.title).toBe("Structured by model");
    expect(body.filename).toBeUndefined();
    await app.close();
  });

  test("saves the structured draft when save is true", async () => {
    const vaultPath = await makeVault();
    const app = buildApp(makeConfig(vaultPath), {
      modelClient: makeFakeModelClient({
        type: "note",
        title: "Save structured draft",
        summary: "Structured and saved.",
        bullets: ["Structured", "Saved"],
        tags: ["notes"],
        relatedNoteHints: [],
        source: "llm",
        createdAt: "2026-06-08T10:00:00Z"
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/notes/structure",
      payload: {
        rawInput: "save this",
        save: true
      }
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.saved).toBe(true);
    expect(body.filename).toBe("2026-06-08-save-structured-draft.md");
    await app.close();
  });
});
