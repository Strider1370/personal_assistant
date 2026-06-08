# Assistant Service

Personal assistant backend for note structuring, Obsidian saves, Notion sync, digest generation, and Telegram delivery.

## Setup

Required `.env` keys:

- `OBSIDIAN_VAULT_PATH`
- `ASSISTANT_PORT` (optional, defaults to `3010`)
- `ASSISTANT_DB_PATH`
- `LLM_PROVIDER`
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_ENABLE_THINKING`
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `DIGEST_TIMEZONE`

Install:

```powershell
cd assistant
npm install
```

## Commands

```powershell
npm run dev
npm run typecheck
npm test
npm run note:structure -- "messy note text"
npm run note:structure -- "messy note text" --save
npm run notion:sync
npm run digest:dry-run
npm run digest:send
npm run telegram:bot
```

## HTTP API

- `GET /health`
- `POST /notes/save`
- `POST /notes/structure`

Example `POST /notes/structure` body:

```json
{
  "rawInput": "Turn this rough idea into a structured note.",
  "save": false
}
```

## Manual Flow

1. Start the server with `npm run dev`.
2. Verify `GET http://localhost:3010/health`.
3. Save a manual structured note through `POST /notes/save`.
4. Generate a structured draft with `POST /notes/structure`.
5. Run `npm run notion:sync` for approved Notion pages.
6. Run `npm run digest:dry-run` to preview the digest without Telegram delivery.
7. Run `npm run digest:send` to send the digest to Telegram immediately.
8. Run `npm run telegram:bot` to start local Telegram polling and reply mode.

## Notes

- Notes always save under `Inbox/`.
- Duplicate filenames receive `-2`, `-3`, and so on.
- Successful writes use temp-file then rename semantics.
- SQLite state is stored in `ASSISTANT_DB_PATH`.
