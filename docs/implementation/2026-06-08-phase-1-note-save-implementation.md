# Phase 1 Note Save Implementation Guide

**Goal:** Build the first runnable `assistant/` backend service that can validate a structured note draft and save it as Markdown under the Obsidian vault `Inbox/`.

**Scope:** Phase 1 only. This does not call the LLM, Telegram, or Notion yet. It only creates the service skeleton, note schema, renderer, writer, API route, and focused safety checks.

**Local vault:** `C:\Users\Jond Doe\Desktop\Project\personal_assistant\Obsidian_vault`

---

## Implementation Shape

Create a new top-level service:

```text
assistant/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts
    server/
      app.ts
      routes/
        health.ts
        notes.ts
    notes/
      note-schema.ts
      note-renderer.ts
      note-writer.ts
    shared/
      config.ts
      logger.ts
  test/
    notes/
      note-renderer.test.ts
      note-writer.test.ts
  data/
    .gitkeep
```

Phase 1 should keep the code deliberately boring:

- `zod` validates all note input.
- `note-renderer.ts` turns validated data into Markdown.
- `note-writer.ts` owns path safety, filename generation, duplicate suffixes, and atomic writes.
- Fastify route code stays thin and delegates work to the note modules.

---

## Dependencies

Use these runtime dependencies:

```text
@fastify/cors
dotenv
fastify
zod
yaml
```

Use these dev dependencies:

```text
@types/node
tsx
typescript
vitest
```

SQLite, LLM client, Telegram, RSS parsing, and Notion dependencies can wait until later phases. That keeps Phase 1 smaller and avoids installing unused packages immediately.

---

## Files To Create

### `assistant/package.json`

Scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  }
}
```

### `assistant/src/shared/config.ts`

Responsibilities:

- Load `.env` from the repository root.
- Validate:
  - `OBSIDIAN_VAULT_PATH`
- Read optional `ASSISTANT_PORT`, defaulting to `3010`.
- Allow future keys to exist without requiring them in Phase 1.
- Require `OBSIDIAN_VAULT_PATH` to be absolute.

### `assistant/src/notes/note-schema.ts`

Responsibilities:

- Define `NoteType`.
- Define `StructuredNoteDraft`.
- Export a `zod` schema.
- Normalize optional fields.

Required shape:

```ts
type NoteType = "idea" | "note" | "task" | "research";

type StructuredNoteDraft = {
  type: NoteType;
  title: string;
  summary: string;
  bullets: string[];
  reflection?: string;
  tags: string[];
  relatedNoteHints: string[];
  source: "manual" | "llm" | "chatgpt" | "learning-assistant" | "notion-sync";
  createdAt: string;
  rawInput?: string;
  notionPageId?: string;
};
```

### `assistant/src/notes/note-renderer.ts`

Responsibilities:

- Render YAML frontmatter safely.
- Render body sections:
  - `# Title`
  - `## Summary`
  - `## Key Points`
  - optional `## Reflection`
- Include optional `rawInput` only if useful later; skip in Phase 1 unless needed.
- Preserve UTF-8.

Frontmatter fields:

```text
type
tags
source
created
related_note_hints
notion_page_id
```

### `assistant/src/notes/note-writer.ts`

Responsibilities:

- Resolve the vault path.
- Ensure `Inbox/` exists.
- Slugify the title.
- Generate `<YYYY-MM-DD>-<slug>.md`.
- If the file exists, generate `-2`, `-3`, etc.
- Ensure the final path stays under `<vault>/Inbox`.
- Write atomically:
  - write `.tmp-<filename>-<random>`
  - rename to final `.md`
- Return:

```ts
type SavedNoteResult = {
  path: string;
  filename: string;
};
```

### `assistant/src/server/routes/notes.ts`

Responsibilities:

- `POST /notes/save`
- Validate request body through `StructuredNoteDraft`.
- Render Markdown.
- Save through `note-writer`.
- Return:

```json
{
  "ok": true,
  "path": "...",
  "filename": "2026-06-08-example.md"
}
```

Invalid input should return a 400 response.

### `assistant/src/server/routes/health.ts`

Responsibilities:

- `GET /health`
- Return:

```json
{ "ok": true }
```

### `assistant/src/server/app.ts`

Responsibilities:

- Create Fastify app.
- Register routes.
- Keep server construction separate from `listen` so tests can import it later.

### `assistant/src/index.ts`

Responsibilities:

- Load config.
- Start server on `ASSISTANT_PORT`, default `3010`.

---

## Minimal Tests

Keep tests focused. Do not build a large test suite in Phase 1.

### `assistant/test/notes/note-renderer.test.ts`

Verify:

- frontmatter is valid YAML
- title, summary, bullets render
- Korean/UTF-8 text survives rendering

### `assistant/test/notes/note-writer.test.ts`

Verify:

- saving writes under `Inbox/`
- duplicate titles produce suffixes
- absolute vault path is required
- traversal-like titles cannot write outside `Inbox/`
- temp files do not remain after a successful save

### `assistant/test/server/notes-route.test.ts`

Verify:

- invalid `POST /notes/save` payloads return 400
- valid `POST /notes/save` payloads return `ok: true` and a filename

These are safety tests, not TDD ceremony.

---

## Implementation Order

1. Create `assistant/` package files.
2. Install Phase 1 dependencies.
3. Create config loader.
4. Create note schema.
5. Create renderer.
6. Create writer.
7. Create Fastify app and routes.
8. Add focused renderer/writer tests.
9. Run typecheck and tests.
10. Manually save one sample note into the real local vault.

---

## Commands

Install dependencies:

```powershell
cd assistant
npm install fastify @fastify/cors zod yaml dotenv
npm install -D typescript tsx vitest @types/node
```

Run checks:

```powershell
cd assistant
npm run typecheck
npm test
```

Run server:

```powershell
cd assistant
npm run dev
```

Manual health check:

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3010/health
```

Manual note save:

```powershell
$body = @{
  type = "idea"
  title = "Frontend Prompt Template Vault Idea"
  summary = "Create a reusable prompt vault for frontend design adjustments."
  bullets = @(
    "Reusable prompt patterns improve output consistency."
    "A vault makes prompts easier to evolve over time."
  )
  reflection = "The quality gap often comes from how precisely visual feel is described."
  tags = @("ai", "vibecoding")
  relatedNoteHints = @("frontend-prompt-templates")
  source = "chatgpt"
  createdAt = "2026-06-08T09:00:00Z"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3010/notes/save `
  -ContentType "application/json" `
  -Body $body
```

Expected result:

- API returns `ok: true`.
- A Markdown file appears under:

```text
C:\Users\Jond Doe\Desktop\Project\personal_assistant\Obsidian_vault\Inbox
```

---

## Phase 1 Done Criteria

- `assistant/` service starts locally.
- `GET /health` returns `{ "ok": true }`.
- `POST /notes/save` writes valid Markdown into the vault `Inbox/`.
- Invalid note payloads return 400.
- Duplicate note titles do not overwrite existing files.
- Successful writes do not leave temp files behind.
- `npm run typecheck` passes.
- Focused renderer, writer, and route-boundary tests pass.

---

## Next Phase Preview

After Phase 1, Phase 2 adds low-cost LLM structuring:

- `POST /notes/structure`
- `llm/model-client.ts`
- default model: `deepseek-v4-flash` through Alibaba Cloud Model Studio
- model-output parser
- mocked parser check
- one manual note structuring run

Do not start Notion or Telegram code until note saving is stable, because both integrations eventually depend on the same renderer/writer path.
