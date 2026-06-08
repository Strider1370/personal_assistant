export type DigestSource = "geek_news" | "hacker_news" | "openai_blog" | "anthropic_blog";

export type DigestItemCandidate = {
  source: DigestSource;
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string;
  reactionScore: number;
  sourceSignals: {
    hnPoints?: number;
    hnComments?: number;
    officialSource?: boolean;
  };
  tags: string[];
};

export type RelatedNoteMatch = {
  title: string;
  path: string;
  reason: string;
};

export type RankedDigestItem = DigestItemCandidate & {
  displayTitle?: string;
  summary: string;
  whyItMatters: string;
  userRelevance: string;
  nextAction?: string;
  relatedNotes?: RelatedNoteMatch[];
};
