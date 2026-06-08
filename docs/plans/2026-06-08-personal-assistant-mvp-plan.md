# Personal Assistant MVP Implementation Plan

**Goal:** Build the first working backend for a personal assistant that can structure notes, save Obsidian markdown, sync approved Notion brainstorming notes, and send a short daily AI/LLM digest through Telegram.

**Source spec:** `docs/specs/2026-06-08-personal-assistant-design.md`

**Planning preference:** This plan intentionally avoids a rigid test-first process. Verification is included only where it protects important behavior: vault path safety, markdown validity, duplicate sync prevention, digest dedupe, and delivery dry runs.

---

## Implementation Principles

- Keep the MVP as one TypeScript backend service.
- Start with deterministic local behavior before adding external integrations.
- Save every note into `Inbox/` first. Do not implement automatic folder routing in MVP.
- Treat Obsidian as the canonical note store.
- Use a low-cost backend model for lightweight structuring and digest ranking. Default to `deepseek-v4-flash` through Alibaba Cloud Model Studio. Keep the client model-configurable so a different Model Studio model can be used later if JSON reliability is weak.
- Use ChatGPT only for user-facing brainstorming; backend sync should consume approved Notion entries.
- Make duplicate saves and duplicate Notion sync attempts safe.
- Prefer small modules with explicit interfaces over one large service file.

---

## Target Project Layout

Create a new top-level service:

```text
assistant/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    server/
      app.ts
      routes/
        health.ts
        notes.ts
    notes/
      note-schema.ts
      note-renderer.ts
      note-writer.ts
      note-index.ts
    llm/
      model-client.ts
      output-parsers.ts
    notion/
      notion-client.ts
      notion-mapper.ts
      notion-sync.ts
    ingest/
      hn-fetcher.ts
      openai-blog-fetcher.ts
      anthropic-blog-fetcher.ts
      dedupe.ts
    digest/
      candidate-filter.ts
      ranker.ts
      formatter.ts
      related-notes.ts
      run-daily-digest.ts
    telegram/
      bot.ts
      send-message.ts
    db/
      sqlite.ts
      migrations.ts
    jobs/
      run-lightweight-note.ts
      run-daily-digest.ts
    shared/
      config.ts
      logger.ts
  data/
    .gitkeep
```

---

## Phase 1: Backend Skeleton And Note Save

**Purpose:** Get a local backend that can accept a structured note draft and write valid Markdown into an Obsidian vault.

### Build

- Create `assistant/package.json` with scripts:
  - `dev`
  - `build`
  - `typecheck`
  - `test`
- Add TypeScript, Fastify, zod, YAML rendering, dotenv, and a test runner.
- Defer SQLite, Telegraf, RSS/HTML parsing, Notion, and LLM client dependencies to later phases.
- Create `shared/config.ts` for Phase 1 environment variables:
  - `OBSIDIAN_VAULT_PATH`
  - `ASSISTANT_PORT`
- Create `server/app.ts` with:
  - `GET /health`
  - `POST /notes/save`
- Create `notes/note-schema.ts` with the shared `StructuredNoteDraft` schema.
- Create `notes/note-renderer.ts` to generate frontmatter and Markdown body.
- Create `notes/note-writer.ts` to:
  - require an absolute `OBSIDIAN_VAULT_PATH`
  - force writes under `<vault>/Inbox`
  - generate filenames as `YYYY-MM-DD-<slug>.md`
  - append `-2`, `-3`, etc. when a filename already exists
  - write atomically by writing a temp file and renaming it
  - preserve UTF-8

### Minimal Verification

- Run `npm run typecheck`.
- Add focused tests for:
  - valid frontmatter rendering
  - path traversal prevention
  - duplicate filename suffix behavior
- Manually save one sample note into a temporary vault and inspect the Markdown.

### Done When

- `POST /notes/save` writes a note to `Inbox/`.
- Invalid drafts are rejected.
- Vault path safety is covered by a focused test.

---

## Phase 2: Lightweight Note Structuring

**Purpose:** Convert messy user text into a normalized note draft using a low-cost model.

### Build

- Create `llm/model-client.ts` with a small OpenAI-compatible interface:
  - input: raw text
  - output: JSON candidate
- Configure the default model as:
  - provider: `alibaba`
  - base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
  - API key: `LLM_API_KEY`, using the Alibaba Cloud Model Studio / DashScope API key
  - model: `deepseek-v4-flash`
  - thinking: disabled
  - endpoint: OpenAI-compatible `POST /chat/completions`
  - request flag: send `enable_thinking: false` when `LLM_ENABLE_THINKING=false`
- Add Phase 2 environment variables:
  - `LLM_PROVIDER`
  - `LLM_BASE_URL`
  - `LLM_API_KEY`
  - `LLM_MODEL`
  - `LLM_ENABLE_THINKING`
- Create `llm/output-parsers.ts` to parse and validate model output against `StructuredNoteDraft`.
- Create `jobs/run-lightweight-note.ts` for manual local runs.
- Add `POST /notes/structure`:
  - accepts raw text
  - calls the configured low-cost model
  - validates output
  - returns a draft preview
- Add optional `save: true` support only after validation succeeds.

### Minimal Verification

- Use a mocked model response to verify parser behavior.
- Manually run one raw note through the job.
- Do not add broad model-quality tests yet; model output quality will be judged manually during MVP.

### Done When

- Raw text can produce a structured draft.
- The backend never saves malformed model JSON.
- The lightweight path does not call ChatGPT.

---

## Phase 3: SQLite State Store

**Purpose:** Track dedupe and sync state before external jobs are added.

### Build

- Create `db/sqlite.ts` for opening the database.
- Create `db/migrations.ts` with tables:
  - `source_items`
  - `sent_digests`
  - `note_index`
  - `notion_sync`
  - `jobs`
- Add startup migration execution.
- Add helper functions for idempotency:
  - mark source item seen
  - mark digest item sent
  - record Notion page sync state
  - record job run start/end

### Minimal Verification

- Run migrations against `assistant/data/assistant.db`.
- Add one focused test or local script confirming repeated inserts do not create duplicate state rows.

### Done When

- Database initialization is deterministic.
- Dedupe keys can be stored and checked.

---

## Phase 4: Notion To Obsidian Sync

**Purpose:** Sync approved ChatGPT brainstorming notes from Notion into Obsidian.

### Build

- Create `docs/prompts/chatgpt-brainstorming-save-instructions.md` with the ChatGPT-side workflow:
  - never move a brainstorming note forward without the exact user command `save`
  - present a structured draft before handoff
  - after `save`, produce a Notion-ready draft matching `StructuredNoteDraft`
  - do not claim the note is already in Obsidian until backend sync has completed
- Create `notion/notion-client.ts` for reading the configured database.
- Create `notion/notion-mapper.ts` to map Notion fields into `StructuredNoteDraft`.
- Create `notion/notion-sync.ts` to:
  - fetch approved entries
  - reject incomplete mapped data
  - save Markdown through `note-writer`
  - record sync status in SQLite
  - avoid duplicate notes for the same Notion page/revision
- Start with polling. Add webhook support later only if polling is not enough.
- Define the Notion approval model explicitly:
  - property `Approval Status` is a Notion `status` or `select` field
  - sync only when `Approval Status` equals `Approved`
  - property `Synced To Obsidian` is a Notion `checkbox`
  - sync only when `Synced To Obsidian` is false, unless a manual retry flag is added later
  - dedupe key is `notion_page_id` plus Notion `last_edited_time`
  - SQLite sync state remains authoritative for preventing repeat writes

### Minimal Verification

- Manually walk through the ChatGPT instruction artifact with one sample brainstorming note and confirm it waits for `save`.
- Manual sync against a non-production Notion page/database.
- One duplicate-sync test using the same Notion page id.
- One incomplete-data mapper test.

### Done When

- An approved Notion entry lands once in Obsidian `Inbox/`.
- Re-running sync does not create duplicate note explosions.
- Incomplete Notion content is rejected instead of guessed.

---

## Phase 5: Learning Digest Fetch And Rank

**Purpose:** Build the daily digest pipeline, including related-note candidates, without Telegram delivery first.

### Build

- Create fetchers:
  - `ingest/hn-fetcher.ts`
  - `ingest/openai-blog-fetcher.ts`
  - `ingest/anthropic-blog-fetcher.ts`
- Create `ingest/dedupe.ts` for source item IDs and sent item tracking.
- Create `digest/candidate-filter.ts`:
  - HN: filter by configurable points/comments/lookback
  - official blogs: include new posts automatically
- Create `digest/ranker.ts`:
  - call low-cost model for user relevance
  - rank by reaction signal, usefulness, novelty, vibe-coding relevance, readability
- Create `digest/formatter.ts`:
  - produce 3-5 items
  - include title, one-line summary, why it matters, user relevance, next action, source link
- Create `notes/note-index.ts`:
  - scan existing Markdown frontmatter
  - cache title, path, tags, type in SQLite
- Create `digest/related-notes.ts`:
  - use digest item tags to find candidate notes
  - ask low-cost model to choose 1-3 best matches
  - allow empty results when candidates are weak
- Include related notes in the dry-run digest output when candidates exist.
- Create `jobs/run-daily-digest.ts` with a dry-run mode.

### Minimal Verification

- Use fixture source items to verify:
  - duplicate items are not resent
  - final digest stays within 3-5 items
  - HN reaction signals are included before LLM ranking
  - tag-based related-note candidates are attempted when matching note metadata exists
- Manual run against a small temporary vault with 3-5 notes.
- Manual dry run with real sources if network/API access is available.

### Done When

- A digest can be generated as plain text without sending it.
- Already-sent items are skipped.
- Related-note lookup runs when tag-based candidates exist.
- Low-volume days have an explicit behavior:
  - send 3-5 items on normal days
  - if there are fewer than 3 strong items, skip delivery
  - do not send a one-item digest unless it is a major official-source release and the run is manually approved

---

## Phase 6: Telegram Delivery

**Purpose:** Send the complete daily digest to the user after ranking and related-note lookup are working.

### Build

- Create `telegram/send-message.ts` for direct message delivery.
- Create `telegram/bot.ts` only for simple future interaction hooks; do not overbuild a command bot in MVP.
- Wire `jobs/run-daily-digest.ts` to send unless `--dry-run` is passed.
- Add scheduler documentation for system cron:
  - command to run
  - timezone
  - log file location

### Minimal Verification

- Manual send to the configured Telegram chat.
- Confirm secrets are not logged.
- Confirm failed delivery records a job failure.

### Done When

- One digest can be sent manually.
- The job can be scheduled through cron.

---

## Phase 7: Operational Hardening

**Purpose:** Make the MVP stable enough to run unattended.

### Build

- Add structured logs for:
  - note save attempts/failures
  - Notion sync attempts/failures
  - digest job start/end
  - source fetch failures
  - LLM parse failures
- Add `README.md` under `assistant/` with:
  - setup
  - env vars
  - commands
  - cron example
  - manual test flow
- Add a documented manual end-to-end dry run:
  - save one structured note
  - sync one approved Notion note
  - generate one digest
  - send one Telegram message
  - link at least one related note candidate

### Minimal Verification

- Run `npm run typecheck`.
- Run focused tests from prior phases.
- Run the manual dry-run checklist once using a non-production vault.

### Done When

- The service has enough logs to debug failed runs.
- Setup and manual operations are documented.
- MVP acceptance checks from the spec are covered by either focused tests or a manual checklist.

---

## Explicit MVP Non-Goals

- No ChatGPT Actions integration.
- No public HTTPS save endpoint requirement.
- No rich web UI.
- No bidirectional Obsidian sync.
- No automatic folder routing out of `Inbox/`.
- No vector database or semantic search.
- No Gmail, Slack, Calendar, finance, or multi-user auth integrations.

---

## Suggested Execution Order

1. Backend skeleton and note save.
2. Lightweight note structuring.
3. SQLite dedupe/state.
4. Notion polling sync.
5. Digest fetch/rank/related-notes dry run.
6. Telegram delivery.
7. Operational docs and final dry run.

This order keeps every phase independently useful and avoids blocking early note capture on external integrations.
