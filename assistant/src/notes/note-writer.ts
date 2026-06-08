import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type SavedNoteResult = {
  path: string;
  filename: string;
};

type SaveNoteMarkdownInput = {
  vaultPath: string;
  title: string;
  createdAt: string;
  markdown: string;
};

export async function saveNoteMarkdown(input: SaveNoteMarkdownInput): Promise<SavedNoteResult> {
  if (!path.isAbsolute(input.vaultPath)) {
    throw new Error("OBSIDIAN_VAULT_PATH must be an absolute path.");
  }

  const resolvedVaultPath = path.resolve(input.vaultPath);
  const inboxPath = path.resolve(resolvedVaultPath, "Inbox");
  await mkdir(inboxPath, { recursive: true });

  const datePrefix = toDatePrefix(input.createdAt);
  const slug = slugifyTitle(input.title);

  let attempt = 1;
  while (true) {
    const filename = `${datePrefix}-${slug}${attempt === 1 ? "" : `-${attempt}`}.md`;
    const finalPath = path.resolve(inboxPath, filename);

    ensurePathInsideInbox(inboxPath, finalPath);

    if (await fileExists(finalPath)) {
      attempt += 1;
      continue;
    }

    const tempPath = path.resolve(
      inboxPath,
      `.tmp-${filename}-${crypto.randomBytes(6).toString("hex")}`
    );

    ensurePathInsideInbox(inboxPath, tempPath);

    try {
      await writeFile(tempPath, input.markdown, { encoding: "utf8", flag: "wx" });
      await rename(tempPath, finalPath);
      return {
        path: finalPath,
        filename
      };
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }
}

function toDatePrefix(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    throw new Error("createdAt must be a valid ISO datetime.");
  }

  return date.toISOString().slice(0, 10);
}

function slugifyTitle(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "note";
}

function ensurePathInsideInbox(inboxPath: string, targetPath: string): void {
  const relative = path.relative(inboxPath, targetPath);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }

  throw new Error("Resolved note path must stay inside Inbox.");
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
