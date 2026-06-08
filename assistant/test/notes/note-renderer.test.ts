import { parse as parseYaml } from "yaml";
import { describe, expect, test } from "vitest";

import { renderStructuredNote } from "../../src/notes/note-renderer.js";
import type { StructuredNoteDraft } from "../../src/notes/note-schema.js";

const baseDraft: StructuredNoteDraft = {
  type: "idea",
  title: "Frontend Prompt Template Vault Idea",
  summary: "Create a reusable prompt vault for frontend design adjustments.",
  bullets: [
    "Reusable prompt patterns improve output consistency.",
    "A vault makes prompts easier to evolve over time."
  ],
  reflection: "The quality gap often comes from how precisely visual feel is described.",
  tags: ["ai", "vibecoding"],
  relatedNoteHints: ["frontend-prompt-templates"],
  source: "chatgpt",
  createdAt: "2026-06-08T09:00:00Z"
};

describe("renderStructuredNote", () => {
  test("renders valid YAML frontmatter", () => {
    const markdown = renderStructuredNote(baseDraft);
    const match = markdown.match(/^---\n([\s\S]*?)\n---/);

    expect(match).not.toBeNull();
    expect(() => parseYaml(match?.[1] ?? "")).not.toThrow();
    expect(parseYaml(match?.[1] ?? "")).toMatchObject({
      type: "idea",
      tags: ["ai", "vibecoding"],
      source: "chatgpt",
      created: "2026-06-08T09:00:00Z",
      related_note_hints: ["frontend-prompt-templates"]
    });
  });

  test("renders title summary and bullets", () => {
    const markdown = renderStructuredNote(baseDraft);

    expect(markdown).toContain("# Frontend Prompt Template Vault Idea");
    expect(markdown).toContain("## Summary");
    expect(markdown).toContain(baseDraft.summary);
    expect(markdown).toContain("## Key Points");
    expect(markdown).toContain("- Reusable prompt patterns improve output consistency.");
    expect(markdown).toContain("- A vault makes prompts easier to evolve over time.");
    expect(markdown).toContain("## Reflection");
  });

  test("preserves korean utf-8 content", () => {
    const markdown = renderStructuredNote({
      ...baseDraft,
      title: "한글 메모 제목",
      summary: "요약도 그대로 저장되어야 한다.",
      bullets: ["첫 번째 포인트", "두 번째 포인트"],
      reflection: "한글과 UTF-8이 깨지면 안 된다."
    });

    expect(markdown).toContain("# 한글 메모 제목");
    expect(markdown).toContain("요약도 그대로 저장되어야 한다.");
    expect(markdown).toContain("- 첫 번째 포인트");
    expect(markdown).toContain("한글과 UTF-8이 깨지면 안 된다.");
  });
});
