import type { AssistantDatabase } from "../db/sqlite.js";
import type { DigestItemCandidate } from "../digest/types.js";

export function filterUnseenCandidates(
  candidates: DigestItemCandidate[],
  database: AssistantDatabase
): DigestItemCandidate[] {
  return candidates.filter(
    (candidate) => !database.hasSeenSourceItem(candidate.source, candidate.sourceId)
  );
}

export function markCandidatesSeen(
  candidates: DigestItemCandidate[],
  database: AssistantDatabase
): void {
  for (const candidate of candidates) {
    database.markSourceItemSeen({
      source: candidate.source,
      sourceId: candidate.sourceId
    });
  }
}
