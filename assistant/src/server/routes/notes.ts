import type { FastifyInstance } from "fastify";

import { parseStructuredNoteDraft, structuredNoteDraftSchema } from "../../notes/note-schema.js";
import { renderStructuredNote } from "../../notes/note-renderer.js";
import { saveNoteMarkdown } from "../../notes/note-writer.js";
import type { AppConfig } from "../../shared/config.js";

export async function registerNotesRoute(
  app: FastifyInstance,
  config: AppConfig
): Promise<void> {
  app.post("/notes/save", async (request, reply) => {
    const parsed = structuredNoteDraftSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: "Invalid note payload.",
        issues: parsed.error.issues
      });
    }

    const draft = parseStructuredNoteDraft(parsed.data);
    const markdown = renderStructuredNote(draft);
    const saved = await saveNoteMarkdown({
      vaultPath: config.obsidianVaultPath,
      title: draft.title,
      createdAt: draft.createdAt,
      markdown
    });

    return {
      ok: true,
      path: saved.path,
      filename: saved.filename
    };
  });
}
