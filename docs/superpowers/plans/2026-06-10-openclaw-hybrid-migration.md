# OpenClaw Hybrid Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Telegram conversation, session memory, and web search onto OpenClaw while keeping the existing `assistant/` backend responsible for Obsidian writes, Notion sync, and daily digest jobs.

**Architecture:** OpenClaw becomes the conversation gateway and tool orchestrator. The current `assistant/` service stays in place as a backend adapter that exposes stable HTTP endpoints for note save, note structuring, health, and future assistant-only operations. Telegram traffic no longer enters `assistant/src/telegram/*`; it enters OpenClaw, which calls the backend when it needs note persistence or assistant-side jobs.

**Tech Stack:** OpenClaw Gateway + plugins/hooks/webhooks, existing Fastify backend, SQLite, Obsidian vault markdown storage, Notion API, Telegram channel, GCP systemd deployment.

---

## File Map

### Keep and reuse

- `assistant/src/server/app.ts`
  Current Fastify app bootstrap. Keep as the long-lived backend API.
- `assistant/src/server/routes/notes.ts`
  Existing note save endpoint. Reuse for OpenClaw-to-Obsidian writes.
- `assistant/src/server/routes/structure.ts`
  Existing note structuring endpoint. Reuse for OpenClaw commands that want lightweight note drafting.
- `assistant/src/notion/*`
  Keep as-is. Notion remains the approval bridge for ChatGPT brainstorming saves.
- `assistant/src/jobs/run-notion-sync.ts`
  Keep as-is. Still runs on server-side schedule or manual trigger.
- `assistant/src/jobs/run-daily-digest-cli.ts`
  Keep as-is. Daily digest remains backend-owned.

### De-emphasize or retire from primary path

- `assistant/src/telegram/bot.ts`
  No longer the primary Telegram entrypoint after cutover. Keep only until rollback window closes.
- `assistant/src/telegram/chat-reply.ts`
  Search and chat logic moves to OpenClaw. Keep only until rollback window closes.
- `assistant/src/jobs/run-telegram-bot.ts`
  Retire after OpenClaw Telegram channel is stable in production.

### Create

- `openclaw/README.md`
  Deployment and operator notes for the OpenClaw sidecar.
- `openclaw/openclaw.json`
  Main OpenClaw gateway config for Telegram channel, memory, plugins, and tool allowlist.
- `openclaw/plugins/assistant-bridge/openclaw.plugin.json`
  Local plugin manifest.
- `openclaw/plugins/assistant-bridge/src/index.ts`
  Plugin entry that registers tools for calling the existing assistant backend.
- `openclaw/plugins/assistant-bridge/src/http-client.ts`
  Thin client for `assistant` HTTP endpoints.
- `openclaw/plugins/assistant-bridge/src/tools/save-note.ts`
  Tool that forwards note-save requests to `POST /notes/save`.
- `openclaw/plugins/assistant-bridge/src/tools/structure-note.ts`
  Tool that forwards note-structure requests to `POST /notes/structure`.
- `openclaw/plugins/assistant-bridge/src/tools/health.ts`
  Tool for backend health visibility and smoke tests.
- `assistant/src/server/routes/openclaw.ts`
  Optional new endpoint group if OpenClaw needs dedicated backend operations not covered by current routes.
- `assistant/test/server/openclaw-route.test.ts`
  Tests for any new backend route added specifically for OpenClaw integration.
- `deployment/systemd/openclaw-gateway.service`
  Example service file for running OpenClaw on GCP beside the current backend.
- `docs/openclaw-migration-runbook.md`
  Operator runbook for cutover, verification, and rollback.

## Migration Rules

- Do not move Notion sync into OpenClaw in phase 1.
- Do not move daily digest generation into OpenClaw in phase 1.
- Do not replace the existing Obsidian writer logic; call it through HTTP.
- Keep the current Telegram bot service runnable until OpenClaw has passed production smoke tests.
- Cut over one responsibility at a time: Telegram chat first, then optional command routing, then cleanup.

## Task 1: Freeze the migration boundary

**Files:**
- Create: `docs/openclaw-migration-runbook.md`
- Modify: `assistant/README.md`
- Modify: `docs/superpowers/plans/2026-06-10-openclaw-hybrid-migration.md`
- Test: none

- [x] **Step 1: Document the target ownership split**

Add a short matrix to `docs/openclaw-migration-runbook.md`:

```md
| Capability | Owner after migration |
| --- | --- |
| Telegram conversation | OpenClaw |
| Web search | OpenClaw |
| Session memory | OpenClaw |
| Obsidian note save | assistant backend |
| Note structuring | assistant backend |
| Notion sync | assistant backend |
| Daily digest | assistant backend |
```

- [x] **Step 2: Add a migration note to backend README**

Append this section to `assistant/README.md`:

```md
## OpenClaw Boundary

When OpenClaw migration is enabled, Telegram conversation and search move to OpenClaw.
This backend remains the source of truth for:

- Obsidian note writes
- note structuring APIs
- Notion sync
- daily digest jobs
```

- [x] **Step 3: Review the boundary against current code**

Check these files and confirm no additional responsibilities leak into Telegram-only code:

```powershell
Get-Content assistant\src\telegram\bot.ts
Get-Content assistant\src\jobs\run-notion-sync.ts
Get-Content assistant\src\jobs\run-daily-digest-cli.ts
```

Expected: Telegram bot owns chat flow only; Notion sync and digest remain isolated jobs.

- [ ] **Step 4: Commit**

```bash
git add docs/openclaw-migration-runbook.md assistant/README.md docs/superpowers/plans/2026-06-10-openclaw-hybrid-migration.md
git commit -m "docs: define openclaw migration boundary"
```

## Task 2: Stand up an OpenClaw workspace in-repo

**Files:**
- Create: `openclaw/README.md`
- Create: `openclaw/openclaw.json`
- Create: `deployment/systemd/openclaw-gateway.service`
- Test: operator smoke check only

- [x] **Step 1: Create the OpenClaw workspace README**

Write this skeleton to `openclaw/README.md`:

```md
# OpenClaw Workspace

This directory contains the OpenClaw gateway config used for Telegram conversation,
session memory, and search.

The existing `assistant/` backend remains responsible for note persistence, Notion sync,
and digest jobs.

## Local bring-up

1. Install OpenClaw.
2. Start the backend at `http://127.0.0.1:3010`.
3. Start OpenClaw with `openclaw gateway start --config ./openclaw/openclaw.json`.
```

- [x] **Step 2: Create a minimal OpenClaw config**

Write this starter config to `openclaw/openclaw.json`:

```json
{
  "gateway": {
    "name": "personal-assistant-gateway"
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botTokenEnv": "TELEGRAM_BOT_TOKEN"
    }
  },
  "memory": {
    "enabled": true
  },
  "plugins": {
    "load": {
      "paths": [
        "./openclaw/plugins/assistant-bridge"
      ]
    }
  },
  "tools": {
    "allow": [
      "assistant.save_note",
      "assistant.structure_note",
      "assistant.health",
      "web_search"
    ]
  }
}
```

- [x] **Step 3: Add a systemd unit template**

Write this to `deployment/systemd/openclaw-gateway.service`:

```ini
[Unit]
Description=OpenClaw Gateway
After=network-online.target assistant-api.service
Wants=network-online.target

[Service]
Type=simple
User=junn1370
WorkingDirectory=/home/junn1370/personal_assistant
Environment=HOME=/home/junn1370
ExecStart=/usr/bin/env openclaw gateway start --config /home/junn1370/personal_assistant/openclaw/openclaw.json
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Verify config parses**

Run:

```bash
openclaw gateway status --config ./openclaw/openclaw.json
```

Expected: config loads; plugin path may still warn until Task 3 is complete.

Blocked locally on 2026-06-10: `openclaw` CLI is not installed on this workstation, so this verification could not be executed yet.

- [ ] **Step 5: Commit**

```bash
git add openclaw/README.md openclaw/openclaw.json deployment/systemd/openclaw-gateway.service
git commit -m "chore: scaffold openclaw workspace"
```

## Task 3: Build an assistant-bridge plugin

**Files:**
- Create: `openclaw/plugins/assistant-bridge/openclaw.plugin.json`
- Create: `openclaw/plugins/assistant-bridge/src/index.ts`
- Create: `openclaw/plugins/assistant-bridge/src/http-client.ts`
- Create: `openclaw/plugins/assistant-bridge/src/tools/save-note.ts`
- Create: `openclaw/plugins/assistant-bridge/src/tools/structure-note.ts`
- Create: `openclaw/plugins/assistant-bridge/src/tools/health.ts`
- Test: `assistant/test/server/openclaw-route.test.ts` only if new backend route is added

- [x] **Step 1: Create the plugin manifest**

Write this to `openclaw/plugins/assistant-bridge/openclaw.plugin.json`:

```json
{
  "id": "assistant-bridge",
  "name": "Assistant Bridge",
  "runtime": "node",
  "entry": "./dist/index.js"
}
```

- [x] **Step 2: Create the HTTP client**

Write this to `openclaw/plugins/assistant-bridge/src/http-client.ts`:

```ts
export type AssistantBridgeConfig = {
  baseUrl: string;
  apiKey?: string;
};

export async function postJson<TResponse>(
  config: AssistantBridgeConfig,
  path: string,
  body: unknown
): Promise<TResponse> {
  const response = await fetch(new URL(path, config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { "X-Assistant-Key": config.apiKey } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`assistant bridge request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
```

- [x] **Step 3: Define the save-note tool**

Write this to `openclaw/plugins/assistant-bridge/src/tools/save-note.ts`:

```ts
import { postJson, type AssistantBridgeConfig } from "../http-client.js";

export async function saveNote(config: AssistantBridgeConfig, rawInput: string) {
  return postJson(config, "/notes/structure", {
    rawInput,
    save: true
  });
}
```

- [x] **Step 4: Define the structure-note tool**

Write this to `openclaw/plugins/assistant-bridge/src/tools/structure-note.ts`:

```ts
import { postJson, type AssistantBridgeConfig } from "../http-client.js";

export async function structureNote(config: AssistantBridgeConfig, rawInput: string) {
  return postJson(config, "/notes/structure", {
    rawInput,
    save: false
  });
}
```

- [x] **Step 5: Define the health tool**

Write this to `openclaw/plugins/assistant-bridge/src/tools/health.ts`:

```ts
export async function checkHealth(baseUrl: string) {
  const response = await fetch(new URL("/health", baseUrl));
  if (!response.ok) {
    throw new Error(`assistant health failed: ${response.status}`);
  }
  return response.json();
}
```

- [x] **Step 6: Register tools in the plugin entry**

Write this to `openclaw/plugins/assistant-bridge/src/index.ts`:

```ts
import { definePluginEntry } from "@openclaw/plugin-sdk";
import { checkHealth } from "./tools/health.js";
import { saveNote } from "./tools/save-note.js";
import { structureNote } from "./tools/structure-note.js";

export default definePluginEntry({
  id: "assistant-bridge",
  name: "Assistant Bridge",
  register(api) {
    const config = {
      baseUrl: process.env.ASSISTANT_BASE_URL ?? "http://127.0.0.1:3010"
    };

    api.tool("assistant.health", async () => checkHealth(config.baseUrl));
    api.tool("assistant.save_note", async ({ rawInput }) => saveNote(config, String(rawInput ?? "")));
    api.tool("assistant.structure_note", async ({ rawInput }) => structureNote(config, String(rawInput ?? "")));
  }
});
```

- [ ] **Step 7: Build and inspect the plugin**

Run:

```bash
openclaw plugins inspect assistant-bridge --runtime --json
```

Expected: `assistant.health`, `assistant.save_note`, and `assistant.structure_note` are visible.

Blocked locally on 2026-06-10: `openclaw` CLI is not installed on this workstation, so this verification could not be executed yet.

- [ ] **Step 8: Commit**

```bash
git add openclaw/plugins/assistant-bridge
git commit -m "feat: add openclaw assistant bridge plugin"
```

## Task 4: Harden backend routes for OpenClaw callers

**Files:**
- Modify: `assistant/src/server/app.ts`
- Create or Modify: `assistant/src/server/routes/openclaw.ts`
- Test: `assistant/test/server/openclaw-route.test.ts`

- [ ] **Step 1: Decide whether current routes are enough**

Review:

```powershell
Get-Content assistant\src\server\routes\notes.ts
Get-Content assistant\src\server\routes\structure.ts
```

Expected: `POST /notes/structure` already covers `save: true` and `save: false`.

- [ ] **Step 2: If needed, add an OpenClaw route group**

Only if you need a separate authenticated surface, add:

```ts
export async function registerOpenClawRoute(app: FastifyInstance) {
  app.post("/openclaw/save-note", async (request) => {
    const body = request.body as { rawInput: string };
    return { ok: true, rawInput: body.rawInput };
  });
}
```

- [ ] **Step 3: Write the failing route test**

Add this to `assistant/test/server/openclaw-route.test.ts` if a new route exists:

```ts
test("accepts an OpenClaw bridge request", async () => {
  const app = buildApp(config, { modelClient });
  const response = await app.inject({
    method: "POST",
    url: "/openclaw/save-note",
    payload: { rawInput: "save this note" }
  });

  expect(response.statusCode).toBe(200);
});
```

- [ ] **Step 4: Run the route test**

Run:

```bash
npm test -- test/server/openclaw-route.test.ts
```

Expected: pass if route was needed; skip this task if existing routes are reused unchanged.

- [ ] **Step 5: Commit**

```bash
git add assistant/src/server/app.ts assistant/src/server/routes/openclaw.ts assistant/test/server/openclaw-route.test.ts
git commit -m "feat: expose backend routes for openclaw bridge"
```

## Task 5: Cut Telegram over to OpenClaw in staging

**Files:**
- Modify: `docs/openclaw-migration-runbook.md`
- Modify: `deployment/systemd/openclaw-gateway.service`
- Test: staging smoke only

- [ ] **Step 1: Stop dual ownership before cutover**

Plan the order in the runbook:

```md
1. Disable `assistant-telegram-bot.service`
2. Enable and start `openclaw-gateway.service`
3. Send `/health` equivalent message from Telegram
4. Send one ordinary chat message
5. Send one search-intent message
6. Send one save-note command
```

- [ ] **Step 2: Add rollback steps**

Add this block:

```md
Rollback:

1. Stop `openclaw-gateway.service`
2. Start `assistant-telegram-bot.service`
3. Confirm Telegram polling resumes
```

- [ ] **Step 3: Run the staging smoke**

Use these real prompts:

```text
OpenAI 지금 CEO 누구야? 인터넷으로 검색해줘
/save 오늘 떠오른 아이디어를 메모로 남겨줘
이 메모를 더 짧게 바꿔줘
```

Expected:

- search reply includes sources
- save command writes into Obsidian via backend
- ordinary chat stays conversational

- [ ] **Step 4: Commit**

```bash
git add docs/openclaw-migration-runbook.md deployment/systemd/openclaw-gateway.service
git commit -m "docs: add openclaw cutover and rollback runbook"
```

## Task 6: Production cutover and cleanup

**Files:**
- Modify: `assistant/src/jobs/run-telegram-bot.ts`
- Modify: `assistant/src/telegram/bot.ts`
- Modify: `assistant/README.md`
- Test: production smoke

- [ ] **Step 1: Mark legacy Telegram bot as deprecated**

Add this note to `assistant/README.md`:

```md
## Legacy Telegram Bot

`npm run telegram:bot` is retained only as a rollback path after OpenClaw migration.
Primary Telegram conversation should route through OpenClaw.
```

- [ ] **Step 2: Remove systemd ownership of the legacy bot only after stable burn-in**

After a successful burn-in window, disable the legacy service:

```bash
sudo systemctl disable --now assistant-telegram-bot.service
```

Expected: OpenClaw remains the only Telegram consumer.

- [ ] **Step 3: Keep digest and Notion jobs on the backend**

Verify these still run independently:

```bash
cd assistant
npm run digest:dry-run
npm run notion:sync
```

Expected: OpenClaw migration does not change digest or Notion behavior.

- [ ] **Step 4: Final verification**

Run:

```bash
cd assistant
npm test
npm run typecheck
```

Expected: all tests pass and backend still builds cleanly.

- [ ] **Step 5: Commit**

```bash
git add assistant/src/jobs/run-telegram-bot.ts assistant/src/telegram/bot.ts assistant/README.md
git commit -m "chore: deprecate legacy telegram bot after openclaw cutover"
```

## Spec coverage check

- Telegram conversation ownership moves to OpenClaw: covered by Tasks 2, 3, 5, 6.
- Session memory and search move to OpenClaw: covered by Tasks 2, 5.
- Obsidian writing stays on current backend: covered by Tasks 1, 3, 4.
- Notion remains approval bridge: covered by Tasks 1 and 6.
- Daily digest remains backend-owned: covered by Tasks 1 and 6.
- Rollback path remains available: covered by Task 5.

## Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every new file path is explicit.
- Commands are concrete and match the current repo layout.

## Type consistency check

- Backend bridge talks to `POST /notes/structure` and `GET /health`, which already fit the current Fastify layout.
- OpenClaw remains an external caller; it does not assume direct imports from `assistant/src/*`.

## Execution recommendation

Start with Tasks 1 through 3 as a spike. Do not cut over production Telegram until the plugin can call the backend locally and return a saved-note result end-to-end.
