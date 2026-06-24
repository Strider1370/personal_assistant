# OpenClaw Workspace

This directory contains the OpenClaw gateway config used for Telegram conversation,
session memory, and search.

The existing `assistant/` backend remains responsible for note persistence, Notion sync,
and digest jobs.

## Local bring-up

1. Install OpenClaw.
2. Start the backend at `http://127.0.0.1:3010`.
3. Start OpenClaw with `openclaw gateway start --config ./openclaw/openclaw.json`.

## Current local blocker

As of 2026-06-10, this repo contains the gateway config and local plugin scaffold,
but `openclaw` CLI is not installed in the current workstation shell yet.
Until that binary is available, `openclaw gateway status` and `openclaw plugins inspect`
cannot be executed locally.
