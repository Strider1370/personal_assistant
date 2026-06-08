import type { AssistantDatabase } from "../db/sqlite.js";
import type { RankedDigestItem, RelatedNoteMatch } from "./types.js";

export async function findRelatedNotesForDigestItem(
  item: RankedDigestItem,
  database: AssistantDatabase
): Promise<RelatedNoteMatch[]> {
  const candidates = database.findNotesByTags(item.tags).slice(0, 3);

  return candidates.map((candidate) => ({
    title: candidate.title,
    path: candidate.path,
    reason: `Overlapping tags: ${candidate.tags.filter((tag) => item.tags.includes(tag)).join(", ")}`
  }));
}
