import type { DigestItemCandidate } from "./types.js";
import { isRelevantDigestCandidate } from "./relevance.js";

export type CandidateFilterOptions = {
  minHnPoints: number;
  minHnComments: number;
};

export function filterDigestCandidates(
  candidates: DigestItemCandidate[],
  options: CandidateFilterOptions
): DigestItemCandidate[] {
  return candidates.filter((candidate) => {
    if (!isRelevantDigestCandidate(candidate)) {
      return false;
    }

    if (candidate.source !== "hacker_news") {
      return true;
    }

    return (
      (candidate.sourceSignals.hnPoints ?? 0) >= options.minHnPoints &&
      (candidate.sourceSignals.hnComments ?? 0) >= options.minHnComments
    );
  });
}
