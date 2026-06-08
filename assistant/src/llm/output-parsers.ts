import { ZodError } from "zod";

import { parseStructuredNoteDraft } from "../notes/note-schema.js";
import type { StructuredNoteDraft } from "../notes/note-schema.js";

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
    return parseStructuredNoteDraft(parsedJson);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Invalid structured note draft from model: ${error.message}`);
    }

    throw error;
  }
}
