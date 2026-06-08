import { stringify as stringifyYaml } from "yaml";

import type { StructuredNoteDraft } from "./note-schema.js";

export function renderStructuredNote(draft: StructuredNoteDraft): string {
  const frontmatter = {
    type: draft.type,
    tags: draft.tags,
    source: draft.source,
    created: draft.createdAt,
    related_note_hints: draft.relatedNoteHints,
    notion_page_id: draft.notionPageId
  };

  const sections = [
    `---\n${stringifyYaml(frontmatter).trimEnd()}\n---`,
    `# ${draft.title}`,
    "## Summary",
    draft.summary,
    "## Key Points",
    ...draft.bullets.map((bullet) => `- ${bullet}`)
  ];

  if (draft.reflection) {
    sections.push("## Reflection", draft.reflection);
  }

  return `${sections.join("\n\n")}\n`;
}
