import { describe, expect, test } from "vitest";

import { formatDigest } from "../../src/digest/formatter.js";
import type { RankedDigestItem } from "../../src/digest/types.js";

describe("formatDigest", () => {
  test("formats digest items around long summaries only", () => {
    const message = formatDigest([
      rankedItem({
        displayTitle: "Korean-friendly title",
        summary: [
          "첫 번째 문장입니다.",
          "두 번째 문장입니다.",
          "세 번째 문장입니다.",
          "네 번째 문장입니다.",
          "다섯 번째 문장입니다.",
          "여섯 번째 문장입니다."
        ].join(" ")
      })
    ]);

    expect(message).toContain("1. Korean-friendly title");
    expect(message).toContain("요약:");
    expect(message).toContain("첫 번째 문장입니다.");
    expect(message).toContain("출처: openai_blog");
    expect(message).toContain("링크: https://example.com/item");
    expect(message).not.toContain("why it matters");
    expect(message).not.toContain("user relevance");
    expect(message).not.toContain("next action");
    expect(message).not.toContain("Related note");
  });
});

function rankedItem(overrides?: Partial<RankedDigestItem>): RankedDigestItem {
  return {
    source: "openai_blog",
    sourceId: "item",
    title: "Original title",
    displayTitle: "Display title",
    url: "https://example.com/item",
    publishedAt: "2026-06-24T00:00:00Z",
    reactionScore: 0,
    sourceSignals: {
      officialSource: true
    },
    tags: ["ai"],
    summary: "Summary.",
    whyItMatters: "why it matters",
    userRelevance: "user relevance",
    nextAction: "next action",
    relatedNotes: [
      {
        title: "Related note",
        path: "C:\\vault\\note.md",
        reason: "tag match"
      }
    ],
    ...overrides
  };
}
