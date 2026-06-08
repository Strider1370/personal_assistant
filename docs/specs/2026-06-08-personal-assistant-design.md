# Personal Assistant Design

## Purpose

Build a personal assistant system with two initial capabilities:

- A note assistant that turns freeform thoughts into structured Obsidian notes.
- A learning/research assistant that sends a daily AI/LLM briefing and later links it to existing notes.

The design deliberately separates low-cost note structuring from high-quality brainstorming. Lightweight note cleanup should use a low-cost model such as Qwen, while deeper idea development should happen in ChatGPT, be approved by the user, be stored in Notion, and then sync into Obsidian through the backend.

## User Goals

The system should help the user do these jobs:

- Capture messy thoughts without having to pre-format them.
- Turn raw thoughts into clean note drafts with titles, summaries, tags, and related-note candidates.
- Use ChatGPT for high-quality brainstorming, store the approved result in Notion, and sync it into Obsidian.
- Receive a short daily briefing about AI/LLM updates, coding-agent tools, plugins, skills, workflows, and unusual new datasets or personas.
- Over time, connect new external information back to the user's note base.

## Confirmed Product Decisions

- The first release has two assistant tracks:
  - Lightweight note structuring.
  - Learning/research briefing.
- Lightweight note structuring uses a low-cost LLM such as Qwen.
- Brainstorming uses ChatGPT, not the low-cost model.
- Brainstorming notes move forward only when the user explicitly says `save`.
- Approved brainstorming output is stored in Notion first, then synced into Obsidian by the backend.
- Obsidian is the canonical note store.
- MVP storage should target a vault on the GCP server, but the design must still allow a synced local vault later.
- Saved notes should go to `Inbox/` first.
- Automatic folder routing is out of scope for MVP. The note type should be stored in frontmatter instead.
- Learning sources for MVP are:
  - Hacker News
  - OpenAI official blog
  - Anthropic official blog
- Daily learning output should be short and limited to 3-5 items.
- Learning-item selection should use a two-step filter:
  - Community reaction or official-source inclusion.
  - LLM relevance scoring for the user's interests.
- Related-note recommendation should start with tag-based candidate filtering, then let an LLM choose the best matches among the filtered candidates.
- The MVP does not depend on ChatGPT Actions or a public HTTPS save endpoint.

## Scope

### In scope for MVP

- One backend service that hosts:
  - note save API for internal/manual use
  - lightweight note structuring endpoints or jobs
  - Notion sync ingestion
  - scheduled learning assistant jobs
  - Telegram integration
- Obsidian markdown note generation
- Notion-to-Obsidian sync for approved brainstorming notes
- Daily learning digest generation
- Persistent dedupe/state tracking for digests
- Basic related-note suggestions based on stored note metadata

### Out of scope for MVP

- ChatGPT Actions integration
- Full Obsidian bidirectional sync protocol
- Automatic note moving from `Inbox/` into permanent folders
- Full semantic search/vector database
- Gmail, Slack, Calendar, or finance integrations
- Multi-user auth
- Rich web UI
- Direct mobile or desktop app

## Architecture

The system should use one TypeScript backend with three logical modules:

1. `note-structuring`
   - Accepts raw text.
   - Calls Qwen.
   - Produces a structured note draft.

2. `notion-sync`
   - Reads approved brainstorming drafts from Notion.
   - Accepts webhook-triggered or polled updates.
   - Converts approved Notion content into Obsidian markdown.
   - Writes markdown into the Obsidian vault.

3. `learning-digest`
   - Fetches source items from HN and official blogs.
   - Filters candidates.
   - Uses an LLM to rank and summarize.
   - Sends a Telegram briefing.
   - Optionally stores the briefing in Obsidian.

```text
Telegram / user text
    -> note-structuring
    -> Qwen
    -> structured note draft
    -> save to Obsidian or return preview

ChatGPT brainstorming
    -> user approval ("save")
    -> approved draft is stored in Notion
    -> backend reads Notion change
    -> markdown written to Obsidian vault

HN + OpenAI + Anthropic
    -> source fetchers
    -> popularity / official-source filter
    -> LLM ranking + summary
    -> Telegram digest
    -> optional Obsidian digest note
```

## Recommended Technical Stack

- Runtime: `Node.js`
- Language: `TypeScript`
- HTTP API: `Fastify`
- Validation: `zod`
- Scheduler: system `cron` plus app-level job entrypoints
- Bot integration: `Telegraf`
- State store: `SQLite`
- Note storage: filesystem markdown in the Obsidian vault
- Notion integration: Notion API plus webhook or polling support
- Feed parsing: RSS parser plus lightweight HTML parsing when needed
- Date utilities: `date-fns` or `dayjs`

This stack is preferred because the project is API-heavy, automation-heavy, and integration-heavy rather than ML-heavy. It keeps bot logic, scheduled jobs, note generation, sync logic, and HTTP endpoints in one codebase.

## Data Model

### Structured note draft

Each note draft should normalize to this shape before save:

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
  source: "qwen" | "chatgpt" | "learning-assistant" | "notion-sync";
  createdAt: string;
  rawInput?: string;
  notionPageId?: string;
};
```

### Saved note markdown format

Saved notes should use markdown with frontmatter:

```md
---
type: idea
tags:
  - ai
  - vibecoding
source: chatgpt
created: 2026-06-08T09:00:00Z
related_note_hints:
  - frontend-prompt-templates
notion_page_id: 12345678-1234-1234-1234-123456789abc
---

# Frontend Prompt Template Vault Idea

## Summary
Create a reusable prompt vault for frontend design adjustments during vibe coding.

## Key Points
- Reusable prompt patterns improve output consistency.
- A vault makes prompts easier to evolve over time.

## Reflection
The quality gap in vibe coding often comes from how precisely the desired visual feel is described.
```

Notes should be saved under:

```text
<vault>/Inbox/YYYY-MM-DD-<slug>.md
```

MVP should not auto-route notes into `Ideas/`, `Research/`, or other folders. The `type` frontmatter is enough for later organization.

If daily digest archival is enabled, those saved digest notes should also go into `Inbox/` first and use a note type in frontmatter such as `note` plus a `digest: true` field, or the type union should be explicitly extended during implementation. MVP should not create a special `Learning/` save path that bypasses the `Inbox/` rule.

### Digest item

```ts
type DigestSource = "hacker_news" | "openai_blog" | "anthropic_blog";

type DigestItem = {
  source: DigestSource;
  sourceId: string;
  title: string;
  url: string;
  publishedAt: string;
  reactionScore: number;
  sourceSignals: {
    hnPoints?: number;
    hnComments?: number;
    officialSource?: boolean;
  };
  summary: string;
  whyItMatters: string;
  userRelevance: string;
  nextAction?: string;
  tags: string[];
  relatedNotes?: RelatedNoteMatch[];
};

type RelatedNoteMatch = {
  title: string;
  path: string;
  reason: string;
};
```

## Note Assistant Design

### Lightweight note path

This path is for quick capture and low-cost structuring.

Input:

- short freeform text
- Telegram message
- pasted note fragment

Flow:

1. Receive raw text.
2. Ask Qwen to classify it into `idea`, `note`, `task`, or `research`.
3. Ask Qwen to return:
   - title
   - summary
   - 2-5 bullet points
   - reflection if present
   - 2-5 tags
4. Run server-side validation on the result.
5. Optionally save directly, or return the draft for preview depending on the calling flow.

This path should be optimized for low latency and low cost, not deep reasoning.

For MVP, this path should use the low-cost model class only. It should not call ChatGPT.

### Brainstorming path

This path is for vague or important ideas where conversation quality matters more than cost.

Flow:

1. The user brainstorms in ChatGPT.
2. ChatGPT helps refine the thought into a structured draft.
3. ChatGPT presents the draft in the agreed note shape.
4. The user explicitly says `save`.
5. The approved draft is copied or stored into Notion in a predefined page/database format.
6. The backend detects the new or updated Notion entry by webhook or polling.
7. The backend converts that Notion content into the agreed markdown note shape.
8. The backend writes the note to the Obsidian vault and records the sync result.

The ChatGPT instructions for this path must explicitly say:

- never move forward without a user `save` command
- present a clean structured draft before any handoff
- after explicit approval, produce a save-ready draft suitable for Notion
- do not pretend the note is already in Obsidian until the backend sync has happened

## Notion Sync Integration

### Goal

Allow ChatGPT-assisted brainstorming output to land in Notion first, then sync into Obsidian through the user's backend.

### Supported mechanism

Notion should act as the intermediate store for approved brainstorming drafts. The backend should read changed pages from Notion through the Notion API, using webhooks when feasible and polling as the MVP-safe fallback.

### Required pieces

- a Notion integration token
- a target Notion database or stable page convention for saved brainstorming drafts
- either:
  - Notion webhook delivery to the backend, or
  - scheduled polling of the target database/page set
- a mapping between Notion fields/blocks and the structured markdown note format

### MVP Notion model

Recommended stored fields in Notion:

- title
- type
- summary
- bullets
- reflection
- tags
- source = `chatgpt`
- approval status
- synced_to_obsidian
- notion_page_id

The backend should only sync entries that are explicitly approved for save.

### Sync behavior

The server should:

1. fetch the approved Notion entry
2. validate the mapped data
3. slugify the title
4. generate markdown
5. write to `<vault>/Inbox/...`
6. mark the Notion item as synced or store a sync record in SQLite

The server should reject incomplete mapped data rather than inventing missing fields during sync.

### Storage safety rules

The implementation should define these rules explicitly:

- `OBSIDIAN_VAULT_PATH` must be configured as an absolute path
- all writes must stay under that vault root
- callers must not be allowed to submit arbitrary relative paths
- filenames should be generated from date + slug only
- duplicate filenames should resolve by appending a deterministic suffix such as `-2`, `-3`, or by using an idempotency key
- repeated Notion sync attempts for the same approved draft should not silently create many duplicate notes
- writes should be atomic, for example write temp file then rename
- frontmatter values and markdown text should be escaped/sanitized so YAML is not broken
- note content should preserve UTF-8 safely

### Notion sync safety rules

The implementation should also define:

- which Notion database or page collection is authoritative
- how approval is represented in Notion
- how `synced_to_obsidian` is represented
- whether webhook delivery or polling is used first
- how duplicate sync attempts are detected by page id plus revision or timestamp

### Local-sync-safe abstraction

Even though MVP targets a server-side vault, the writer implementation should depend on a single vault path interface rather than hard-coding a GCP-only assumption. That keeps later local sync or mirrored-vault support possible without changing the note schema.

## Learning Assistant Design

### Goal

Deliver a short daily briefing focused on:

- LLM updates
- coding-agent improvements
- vibe-coding plugins, skills, and workflows
- unusual but practically interesting technologies, datasets, or personas

### Source strategy

MVP sources:

- Hacker News
- OpenAI official blog
- Anthropic official blog

Hacker News provides reaction signals and community relevance. Official blogs provide canonical product updates even when community voting signals are unavailable.

For MVP model usage, the digest filter and ranking path should use the same low-cost model class as lightweight note structuring unless quality proves inadequate. ChatGPT should not be assumed for backend digest processing by default.

### Candidate filtering

#### Step 1: source-specific candidate selection

For `Hacker News`:

- use top or best stories for the lookback window
- retain only items above a configurable threshold for points and comments
- decay older items so stale stories lose rank

For `OpenAI` and `Anthropic`:

- include new official posts automatically
- dedupe against previously sent items

#### Step 2: LLM topic relevance filter

The LLM should prefer items about:

- new LLM releases or updates
- coding agents
- developer plugins, skills, MCPs, workflows
- tools that improve coding or design output
- unusual data, personas, or practical experiments

The LLM should deprioritize:

- finance and investment news
- purely academic content with low direct usability
- generic PR announcements without meaningful capability change
- duplicate coverage of the same event

#### Step 3: ranking

Each candidate should receive a score driven by:

- reaction signal
- direct usefulness
- vibe-coding relevance
- novelty
- readability for a non-research-heavy user
- interestingness for unusual tools, data, or personas

The implemented order should be:

1. source fetch
2. source-specific candidate selection using reaction signals or official inclusion
3. LLM relevance filter on the reduced candidate set
4. final ranking using both source signals and LLM-derived usefulness fields

### Daily output

The digest should contain 3-5 items.

Each item should include:

- title
- one-line summary
- why it matters
- why it matters specifically to this user
- one possible next action
- source link

### Delivery

Primary delivery:

- Telegram message once per day

Optional persistence:

- save the day's digest into Obsidian under a learning-digest note

## Related Note Recommendation

### Goal

When the learning assistant presents a new item, it should attempt to show 1-3 existing notes that are relevant to it whenever tag-based candidates exist. Empty results are acceptable when no credible candidate set exists.

### MVP logic

1. Extract tags for the digest item.
2. Search note metadata for overlapping tags.
3. Build a small candidate set.
4. Ask an LLM to select the best 1-3 related notes from that candidate set.
5. Return each chosen note with a one-line reason.

This gives better results than pure tags while avoiding the complexity of a full vector-search system in MVP.

For MVP model usage, this final related-note selection should also use the low-cost backend model class first. A later upgrade can swap in a higher-quality model if the reasons or match quality are weak.

### Why not embeddings yet

Embeddings and vector search are likely useful later, but they add infrastructure and retrieval complexity. The agreed MVP should stay simple:

- note metadata file scan
- candidate filter
- LLM final match

## Storage and State

### Filesystem

- Obsidian vault directory on the GCP server
- markdown note files stored under `Inbox/`
- optional digest notes stored under `Inbox/` with digest-identifying frontmatter

### SQLite

SQLite should track:

- already-seen source items
- already-sent digest items
- source fetch timestamps
- note index cache for tag and title lookup
- notion sync status and dedupe information

Suggested tables:

- `source_items`
- `sent_digests`
- `note_index`
- `notion_sync`
- `jobs`

## Security and Operations

### Secrets

Store in environment variables:

- Telegram bot token
- Qwen API key
- Notion integration token
- Notion database or page identifiers
- optional OpenAI API key if the backend ever calls OpenAI directly

### Notion integration protection

The backend should verify incoming Notion webhook requests when webhooks are used, and it should keep the Notion token scoped to the minimum required workspace or database access.

### Logging

Log:

- save attempts
- save failures
- notion sync attempts
- notion sync failures
- digest run start/end
- source fetch failures
- LLM parsing failures

Do not log raw secrets.

### Scheduling behavior

The digest job should define:

- an explicit timezone
- a lookback window for each run
- what happens when a run finds fewer than 3 strong items
- whether empty or low-volume days send a short "nothing worth sending today" digest or skip delivery

MVP should choose one behavior and test it explicitly rather than leaving it implicit.

## Project Structure

Recommended new project layout:

```text
assistant/
  src/
    server/
      app.ts
      routes/
        notes.ts
        health.ts
    notes/
      note-schema.ts
      note-renderer.ts
      note-writer.ts
      note-index.ts
    notion/
      notion-client.ts
      notion-mapper.ts
      notion-sync.ts
      notion-webhook.ts
    llm/
      qwen-client.ts
      ranking-client.ts
      output-parsers.ts
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
      migrations/
    jobs/
      run-lightweight-note.ts
      run-daily-digest.ts
    shared/
      config.ts
      logger.ts
  data/
    assistant.db
```

This assistant service can live as a new top-level directory in the repository so it stays isolated from the existing aviation dashboard code.

## Verification

The implementation should be verified with:

- TypeScript typecheck
- backend tests for note rendering and save validation
- backend tests for source dedupe and ranking inputs
- one manual Notion-to-Obsidian sync test against a non-production vault
- one manual Telegram digest delivery test
- one end-to-end dry run that:
  - saves one approved brainstorming note
  - generates one digest
  - links at least one related note candidate
- one Notion webhook or polling sync test
- one duplicate-save or idempotency test
- one vault-path safety test
- one deterministic digest-ranking fixture test
- one empty-or-low-volume digest-day test

Critical acceptance checks:

- ChatGPT does not move a brainstorming note forward unless the user explicitly says `save`.
- Saved notes land in `Inbox/` with valid frontmatter.
- Qwen note drafts always normalize to the shared schema.
- Approved Notion entries sync exactly once into Obsidian or remain safely retryable without duplicate explosions.
- Digest candidates dedupe correctly across runs.
- Daily digest stays within 3-5 items.
- HN reaction signals influence source-specific candidate selection before LLM filtering and remain an input to final ranking.
- Related-note recommendation runs when tag-based candidates exist, even if it sometimes returns no final matches.
- The system has a documented and testable Notion sync path.

## Rollout Plan

### Phase 1

- backend skeleton
- markdown note save API
- SQLite state store
- Qwen lightweight note structuring

### Phase 2

- Notion integration setup
- Notion-to-Obsidian sync path
- manual end-to-end brainstorming save verification

### Phase 3

- HN + OpenAI + Anthropic fetchers
- ranking and digest formatting
- Telegram delivery

### Phase 4

- related-note recommendation
- optional digest archival into Obsidian

## Open Questions Resolved In This Design

- Storage target: both local and server vaults should be supported, but MVP targets the server vault.
- Save trigger: explicit user approval only.
- Folder routing: save into `Inbox/` and store note type in frontmatter.
- Model split: Qwen for lightweight structuring, ChatGPT for brainstorming, Notion as the approved brainstorming handoff store.
