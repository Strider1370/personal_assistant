import { parseStructuredNoteDraft } from "../notes/note-schema.js";
import type { StructuredNoteDraft } from "../notes/note-schema.js";
import type { NotionPageSummary } from "./notion-client.js";

export function mapNotionPageToDraft(page: NotionPageSummary): StructuredNoteDraft {
  return parseStructuredNoteDraft({
    type: page.properties.type,
    title: page.properties.title,
    summary: page.properties.summary,
    bullets: page.properties.bullets,
    reflection: page.properties.reflection,
    tags: page.properties.tags,
    relatedNoteHints: [],
    source: "chatgpt",
    createdAt: page.lastEditedTime,
    notionPageId: page.id
  });
}

export function isApprovedNotionPage(page: NotionPageSummary): boolean {
  return page.properties.approvalStatus === "Approved" && page.properties.syncedToObsidian === false;
}
