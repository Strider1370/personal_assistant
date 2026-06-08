import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { saveNoteMarkdown } from "../../src/notes/note-writer.js";

const tempDirs: string[] = [];

async function makeVault(): Promise<string> {
  const vaultPath = await mkdtemp(path.join(os.tmpdir(), "assistant-note-writer-"));
  tempDirs.push(vaultPath);
  return vaultPath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("saveNoteMarkdown", () => {
  test("writes notes under Inbox", async () => {
    const vaultPath = await makeVault();
    const result = await saveNoteMarkdown({
      vaultPath,
      title: "Inbox Target",
      createdAt: "2026-06-08T09:00:00Z",
      markdown: "# Inbox Target"
    });

    expect(result.filename).toBe("2026-06-08-inbox-target.md");
    expect(result.path.startsWith(path.join(vaultPath, "Inbox"))).toBe(true);
  });

  test("adds numeric suffixes for duplicate titles", async () => {
    const vaultPath = await makeVault();
    await saveNoteMarkdown({
      vaultPath,
      title: "Duplicate Title",
      createdAt: "2026-06-08T09:00:00Z",
      markdown: "# First"
    });

    const second = await saveNoteMarkdown({
      vaultPath,
      title: "Duplicate Title",
      createdAt: "2026-06-08T09:00:00Z",
      markdown: "# Second"
    });

    expect(second.filename).toBe("2026-06-08-duplicate-title-2.md");
  });

  test("requires an absolute vault path", async () => {
    await expect(() =>
      saveNoteMarkdown({
        vaultPath: "relative-vault",
        title: "Nope",
        createdAt: "2026-06-08T09:00:00Z",
        markdown: "# Nope"
      })
    ).rejects.toThrow(/absolute/i);
  });

  test("keeps traversal-like titles inside Inbox", async () => {
    const vaultPath = await makeVault();
    const result = await saveNoteMarkdown({
      vaultPath,
      title: "..\\..\\escape/attempt",
      createdAt: "2026-06-08T09:00:00Z",
      markdown: "# Safe"
    });

    const expectedInbox = path.resolve(vaultPath, "Inbox");
    const resolvedSavedPath = path.resolve(result.path);

    expect(resolvedSavedPath.startsWith(expectedInbox)).toBe(true);
    expect(result.filename).toMatch(/^2026-06-08-/);
  });

  test("does not leave temp files after successful save", async () => {
    const vaultPath = await makeVault();
    const result = await saveNoteMarkdown({
      vaultPath,
      title: "Atomic Save",
      createdAt: "2026-06-08T09:00:00Z",
      markdown: "# Atomic Save\n\n한글 보존"
    });
    const inboxPath = path.join(vaultPath, "Inbox");
    const files = await readdir(inboxPath);
    const content = await readFile(result.path, "utf8");

    expect(files.some((file) => file.startsWith(".tmp-"))).toBe(false);
    expect(content).toContain("한글 보존");
  });
});
