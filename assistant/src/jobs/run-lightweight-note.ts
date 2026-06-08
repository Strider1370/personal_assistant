import { createNoteStructureModelClient } from "../llm/model-client.js";
import { renderStructuredNote } from "../notes/note-renderer.js";
import { saveNoteMarkdown } from "../notes/note-writer.js";
import { loadConfig } from "../shared/config.js";

const config = loadConfig();
const rawInput = process.argv
  .slice(2)
  .filter((value) => value !== "--save")
  .join(" ")
  .trim();

if (!rawInput) {
  console.error('Usage: npm run note:structure -- "raw note text" [--save]');
  process.exit(1);
}

const client = createNoteStructureModelClient(config);
const result = await client.structureRawNote(rawInput);
const shouldSave = process.argv.includes("--save");

if (!shouldSave) {
  console.log(JSON.stringify(result.draft, null, 2));
  process.exit(0);
}

const markdown = renderStructuredNote(result.draft);
const saved = await saveNoteMarkdown({
  vaultPath: config.obsidianVaultPath,
  title: result.draft.title,
  createdAt: result.draft.createdAt,
  markdown
});

console.log(
  JSON.stringify(
    {
      ok: true,
      filename: saved.filename,
      path: saved.path
    },
    null,
    2
  )
);
