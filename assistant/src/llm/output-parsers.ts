import { ZodError } from "zod";

import { parseStructuredNoteDraft } from "../notes/note-schema.js";
import type { NoteSource, NoteType, StructuredNoteDraft } from "../notes/note-schema.js";

const NOTE_TYPES: readonly NoteType[] = ["idea", "note", "task", "research"];
const NOTE_SOURCES: readonly NoteSource[] = [
  "manual",
  "llm",
  "chatgpt",
  "learning-assistant",
  "notion-sync"
];

// Flaky models often emit a `type` outside the enum (e.g. "shopping", "memo",
// Korean labels). Map common synonyms; fall back to "note" for anything unknown.
const TYPE_ALIASES: Record<string, NoteType> = {
  idea: "idea",
  insight: "idea",
  note: "note",
  memo: "note",
  general: "note",
  task: "task",
  todo: "task",
  "to-do": "task",
  action: "task",
  reminder: "task",
  research: "research",
  study: "research",
  reference: "research"
};

function coerceType(value: unknown): NoteType {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (TYPE_ALIASES[key]) {
      return TYPE_ALIASES[key];
    }
    if ((NOTE_TYPES as readonly string[]).includes(key)) {
      return key as NoteType;
    }
  }
  return "note";
}

// Repair the most common model-output gaps before strict validation. We only
// fall back on structural fields (type/source/bullets/createdAt); missing core
// content (title/summary) still fails validation so genuinely broken output is
// surfaced rather than silently saved.
function normalizeModelDraft(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const draft = { ...(input as Record<string, unknown>) };

  draft.type = coerceType(draft.type);

  if (typeof draft.source !== "string" || !(NOTE_SOURCES as readonly string[]).includes(draft.source)) {
    draft.source = "llm";
  }

  const bullets = Array.isArray(draft.bullets)
    ? draft.bullets.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (bullets.length === 0) {
    const fallback =
      typeof draft.summary === "string" && draft.summary.trim().length > 0
        ? draft.summary.trim()
        : typeof draft.title === "string"
          ? draft.title.trim()
          : "";
    draft.bullets = fallback ? [fallback] : [];
  } else {
    draft.bullets = bullets;
  }

  // The note is being created now; the model's createdAt is unreliable (it
  // routinely hallucinates past dates, which then leak into the filename/date
  // prefix). Always stamp the current time.
  draft.createdAt = new Date().toISOString();

  return draft;
}

export function parseStructuredNoteDraftFromModel(rawContent: string): StructuredNoteDraft {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawContent);
  } catch (error) {
    throw new Error(
      `Invalid model response: ${(error instanceof Error ? error.message : String(error))}`
    );
  }

  try {
    return parseStructuredNoteDraft(normalizeModelDraft(parsedJson));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Invalid structured note draft from model: ${error.message}`);
    }

    throw error;
  }
}
