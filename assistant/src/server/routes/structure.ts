import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { renderStructuredNote } from "../../notes/note-renderer.js";
import { saveNoteMarkdown } from "../../notes/note-writer.js";
import type { NoteStructureModelClient } from "../../llm/model-client.js";
import type { AppConfig } from "../../shared/config.js";

const structureRequestSchema = z.object({
  rawInput: z.string().trim().min(1),
  save: z.boolean().optional().default(false)
});

export async function registerStructureRoute(
  app: FastifyInstance,
  config: AppConfig,
  modelClient: NoteStructureModelClient
): Promise<void> {
  app.post("/notes/structure", async (request, reply) => {
    const parsed = structureRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: "Invalid structure payload.",
        issues: parsed.error.issues
      });
    }

    const { rawInput, save } = parsed.data;
    const result = await modelClient.structureRawNote(rawInput);

    if (!save) {
      return {
        ok: true,
        saved: false,
        draft: result.draft
      };
    }

    const markdown = renderStructuredNote(result.draft);
    const savedNote = await saveNoteMarkdown({
      vaultPath: config.obsidianVaultPath,
      title: result.draft.title,
      createdAt: result.draft.createdAt,
      markdown
    });

    return {
      ok: true,
      saved: true,
      draft: result.draft,
      path: savedNote.path,
      filename: savedNote.filename
    };
  });
}
