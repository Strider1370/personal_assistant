import { z } from "zod";

export type NoteType = "idea" | "note" | "task" | "research";

export type NoteSource = "manual" | "llm" | "chatgpt" | "learning-assistant" | "notion-sync";

export type StructuredNoteDraft = {
  type: NoteType;
  title: string;
  summary: string;
  bullets: string[];
  reflection?: string;
  tags: string[];
  relatedNoteHints: string[];
  source: NoteSource;
  createdAt: string;
  rawInput?: string;
  notionPageId?: string;
};

const normalizedOptionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const structuredNoteDraftSchema: z.ZodType<StructuredNoteDraft> = z.object({
  type: z.enum(["idea", "note", "task", "research"]),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  bullets: z.array(z.string().trim().min(1)).min(1),
  reflection: normalizedOptionalString,
  tags: z.array(z.string().trim().min(1)).default([]),
  relatedNoteHints: z.array(z.string().trim().min(1)).default([]),
  source: z.enum(["manual", "llm", "chatgpt", "learning-assistant", "notion-sync"]),
  createdAt: z.string().datetime(),
  rawInput: normalizedOptionalString,
  notionPageId: normalizedOptionalString
});

export function parseStructuredNoteDraft(input: unknown): StructuredNoteDraft {
  return structuredNoteDraftSchema.parse(input);
}
