# OpenClaw Migration Runbook

## Ownership Boundary

| Capability | Owner after migration |
| --- | --- |
| Telegram conversation | OpenClaw |
| Web search | OpenClaw |
| Session memory | OpenClaw |
| Obsidian note save | assistant backend |
| Note structuring | assistant backend |
| Notion sync | assistant backend |
| Daily digest | assistant backend |

## Current local blocker

The repository-side migration scaffold is in place, but local OpenClaw verification is
blocked until the `openclaw` CLI is installed on the workstation. The missing commands are:

- `openclaw gateway status --config ./openclaw/openclaw.json`
- `openclaw plugins inspect assistant-bridge --runtime --json`
