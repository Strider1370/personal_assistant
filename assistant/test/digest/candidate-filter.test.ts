import { describe, expect, test } from "vitest";

import { filterDigestCandidates } from "../../src/digest/candidate-filter.js";
import type { DigestItemCandidate } from "../../src/digest/types.js";

const hnItem = (overrides?: Partial<DigestItemCandidate>): DigestItemCandidate => ({
  source: "hacker_news",
  sourceId: "hn-1",
  title: "Agent tool launch",
  url: "https://example.com/hn-1",
  publishedAt: "2026-06-08T10:00:00Z",
  reactionScore: 100,
  sourceSignals: {
    hnPoints: 120,
    hnComments: 45
  },
  tags: ["ai"],
  ...overrides
});

describe("filterDigestCandidates", () => {
  test("keeps HN items only when reaction thresholds are met", () => {
    const result = filterDigestCandidates(
      [
        hnItem(),
        hnItem({
          sourceId: "hn-2",
          sourceSignals: {
            hnPoints: 10,
            hnComments: 1
          }
        })
      ],
      {
        minHnPoints: 50,
        minHnComments: 10
      }
    );

    expect(result.map((item) => item.sourceId)).toEqual(["hn-1"]);
  });

  test("always keeps official blog items", () => {
    const result = filterDigestCandidates(
      [
        {
          source: "openai_blog",
          sourceId: "oa-1",
          title: "Official update",
          url: "https://example.com/oa-1",
          publishedAt: "2026-06-08T10:00:00Z",
          reactionScore: 0,
          sourceSignals: {
            officialSource: true
          },
          tags: ["release"]
        }
      ],
      {
        minHnPoints: 50,
        minHnComments: 10
      }
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("openai_blog");
  });
});
