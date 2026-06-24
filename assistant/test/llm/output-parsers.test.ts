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

  test("coerces an unknown note type to 'note' instead of failing", () => {
    const draft = parseStructuredNoteDraftFromModel(
      JSON.stringify({
        type: "shopping",
        title: "Buy milk",
        summary: "Pick up milk tomorrow.",
        bullets: ["Buy milk", "Call mom"],
        source: "llm",
        createdAt: "2026-06-08T10:00:00Z"
      })
    );

    expect(draft.type).toBe("note");
  });

  test("maps common type aliases to the canonical enum", () => {
    const draft = parseStructuredNoteDraftFromModel(
      JSON.stringify({
        type: "todo",
        title: "Ship deploy",
        summary: "Finish the deployment.",
        bullets: ["Push", "Verify"],
        source: "llm",
        createdAt: "2026-06-08T10:00:00Z"
      })
    );

    expect(draft.type).toBe("task");
  });

  test("recovers from missing source, bullets, and createdAt", () => {
    const draft = parseStructuredNoteDraftFromModel(
      JSON.stringify({
        type: "note",
        title: "Resilient draft",
        summary: "Model omitted several fields."
      })
    );

    expect(draft.source).toBe("llm");
    expect(draft.bullets.length).toBeGreaterThan(0);
    expect(() => new Date(draft.createdAt).toISOString()).not.toThrow();
  });

  test("rejects malformed model output that lacks core content", () => {
    expect(() =>
      parseStructuredNoteDraftFromModel(
        JSON.stringify({
          type: "note"
        })
      )
    ).toThrow(/invalid/i);
  });
});
