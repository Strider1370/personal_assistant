import type { DigestItemCandidate } from "../digest/types.js";

export type DigestCandidateFetcher = {
  fetchCandidates(): Promise<DigestItemCandidate[]>;
};
