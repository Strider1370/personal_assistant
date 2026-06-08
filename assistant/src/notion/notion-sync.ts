import { renderStructuredNote } from "../notes/note-renderer.js";
import { saveNoteMarkdown } from "../notes/note-writer.js";
import type { AssistantDatabase } from "../db/sqlite.js";
import { isApprovedNotionPage, mapNotionPageToDraft } from "./notion-mapper.js";
import type { NotionSyncClient } from "./notion-client.js";

type SyncApprovedNotionPagesInput = {
  notionClient: NotionSyncClient;
  database: AssistantDatabase;
  vaultPath: string;
};

type NotionSyncResult = {
  saved: Array<{ pageId: string; filename: string; path: string }>;
  skipped: Array<{ pageId: string; reason: string }>;
  failed: Array<{ pageId: string; reason: string }>;
};

export async function syncApprovedNotionPages(
  input: SyncApprovedNotionPagesInput
): Promise<NotionSyncResult> {
  const pages = await input.notionClient.listCandidatePages();
  const result: NotionSyncResult = {
    saved: [],
    skipped: [],
    failed: []
  };

  for (const page of pages) {
    if (!isApprovedNotionPage(page)) {
      result.skipped.push({
        pageId: page.id,
        reason: "Page is not approved for sync."
      });
      continue;
    }

    const revisionKey = page.lastEditedTime;

    if (input.database.hasNotionSync(page.id, revisionKey)) {
      result.skipped.push({
        pageId: page.id,
        reason: "Page revision already synced."
      });
      continue;
    }

    try {
      const draft = mapNotionPageToDraft(page);
      const markdown = renderStructuredNote(draft);
      const saved = await saveNoteMarkdown({
        vaultPath: input.vaultPath,
        title: draft.title,
        createdAt: draft.createdAt,
        markdown
      });

      input.database.recordNotionSync({
        pageId: page.id,
        revisionKey,
        notePath: saved.path
      });

      result.saved.push({
        pageId: page.id,
        filename: saved.filename,
        path: saved.path
      });
    } catch (error) {
      result.failed.push({
        pageId: page.id,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}
