import { readFile } from "node:fs/promises";
import path from "node:path";
import { readdir } from "node:fs/promises";

import { parse as parseYaml } from "yaml";

import type { AssistantDatabase } from "../db/sqlite.js";

type IndexedNote = {
  path: string;
  title: string;
  type: string;
  tags: string[];
};

export async function scanNotesIntoIndex(
  filePaths: string[],
  database: AssistantDatabase
): Promise<IndexedNote[]> {
  const indexed: IndexedNote[] = [];

  for (const filePath of filePaths) {
    const content = await readFile(filePath, "utf8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const titleMatch = content.match(/^# (.+)$/m);

    if (!frontmatterMatch || !titleMatch) {
      continue;
    }

    const frontmatter = parseYaml(frontmatterMatch[1]) as {
      type?: string;
      tags?: string[];
    };

    const note = {
      path: path.resolve(filePath),
      title: titleMatch[1],
      type: frontmatter.type ?? "note",
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : []
    };

    database.upsertNoteIndex(note);
    indexed.push(note);
  }

  return indexed;
}

export async function collectMarkdownFiles(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootPath, entry.name);

      if (entry.isDirectory()) {
        return collectMarkdownFiles(fullPath);
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        return [fullPath];
      }

      return [];
    })
  );

  return files.flat();
}
