import { describe, expect, test } from "vitest";

import { parseStructuredNoteDraftFromModel } from "../../src/llm/output-parsers.js";

describe("parseStructuredNoteDraftFromModel", () => {
  test("parses valid model JSON into a structured note draft", () => {
    const draft = parseStructuredNoteDraftFromModel(
      JSON.stringify({
        type: "research",
        title: "Agentic coding workflow patterns",
        summary: "A normalized draft from model output.",
        bullets: ["Keep modules small", "Validate output", "Persist useful notes"],
        tags: ["ai", "workflow"],
        relatedNoteHints: ["prompt-vault"],
        source: "llm",
        createdAt: "2026-06-08T10:00:00Z"
      })
    );

    expect(draft.type).toBe("research");
    expect(draft.source).toBe("llm");
    expect(draft.bullets).toHaveLength(3);
  });

  test("rejects malformed model output", () => {
    expect(() =>
      parseStructuredNoteDraftFromModel(
        JSON.stringify({
          title: "Missing fields"
        })
      )
    ).toThrow(/invalid/i);
  });
});
