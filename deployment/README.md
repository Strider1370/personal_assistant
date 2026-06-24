# Deployment Guide — Personal Assistant (GCP + systemd)

Reproduces the working stack (OpenClaw + Telegram + Alibaba LLM + assistant
backend) on the **GCP Linux server** using **systemd**. No Docker.

Server (confirmed): GCP `dashboard` instance, `us-west1-a`, e2-micro (~1 GB RAM,
co-located with nginx + `koreansim-backend`). Repo at
`/home/junn1370/personal_assistant`, user `junn1370`. Node **v24.16.0 via nvm**
(`/home/junn1370/.nvm/versions/node/v24.16.0/bin`) — `node:sqlite` needs ≥ 22.5.
The systemd units pin that nvm node path explicitly. System `/usr/bin/node` (v20)
is unused.

> **Migrating from the existing old setup.** The server currently runs an older
> commit with `assistant-api.service` **and** `assistant-telegram-bot.service`
> (direct Telegram polling). The bot poller must be **stopped + disabled** before
> the OpenClaw gateway starts (one Telegram consumer only). The new
> `assistant-api.service` here replaces the old unit.

## Architecture

```
Telegram  ─(outbound long-poll)─┐
                                ▼
                       openclaw-gateway ── loads ──> assistant-bridge plugin
                         │  (Alibaba LLM)                    │ HTTP 127.0.0.1:3010
                         │                                   ▼
                         └───────────────────────────> assistant-api (Fastify)
                                                          ├─ Obsidian note save
                                                          ├─ note structuring
                                                          ├─ Notion sync
                                                          └─ daily digest (timer)
```

| Capability            | Owner            | systemd unit |
| --------------------- | ---------------- | ------------ |
| Telegram conversation | openclaw-gateway | `openclaw-gateway.service` |
| LLM / web search      | openclaw-gateway | ↑ |
| Session memory        | openclaw-gateway | ↑ |
| Note save / structure | assistant-api    | `assistant-api.service` |
| Notion sync           | assistant-api    | (manual / future timer) |
| Daily digest          | digest job       | `assistant-digest.service` + `.timer` |

### Security model
- Gateway binds **loopback** and only makes *outbound* connections (Telegram +
  LLM). Port `18789` is never exposed; no firewall rule needed for it.
- API listens on `:3010`; do **not** open it in the GCP firewall. Access is
  loopback-only (gateway → `127.0.0.1:3010`).
- Secrets live in `/home/junn1370/personal_assistant/.env` (chmod 600).

> **One Telegram consumer only.** OpenClaw owns the conversation (long-polls
> `getUpdates`). Do **not** also run `npm run telegram:bot` on the server — two
> pollers on the same bot token conflict. The digest only *sends* (outbound), so
> it coexists safely.

---

## Files

- `.env.example` → copy to `.env` on the server
- `openclaw/openclaw.gcp.json` — server config (plugin path = GCP absolute path)
- `deployment/systemd/assistant-api.service`
- `deployment/systemd/openclaw-gateway.service`
- `deployment/systemd/assistant-digest.service` + `assistant-digest.timer`

---

## One-time setup on the GCP server

```bash
# 0. clone / pull
cd /home/junn1370 && git clone <repo> personal_assistant   # or: git pull
cd /home/junn1370/personal_assistant

# 1. Node — already present via nvm on this server
node -v   # expect v24.16.0 (login shell sources nvm; node:sqlite needs >= 22.5)

# 2. secrets
cp .env.example .env && chmod 600 .env
nano .env          # fill LLM_API_KEY, TELEGRAM_BOT_TOKEN, NOTION_*, etc.

# 3. build backend
cd assistant && npm ci && npm run build && cd ..

# 4. build bridge plugin (installs the openclaw CLI into its node_modules)
cd openclaw/plugins/assistant-bridge && npm ci && npm run build && cd -

# 5. make sure the Obsidian vault dir exists on the server
mkdir -p /home/junn1370/personal_assistant/Obsidian_vault
```

## Install + start services

```bash
# Stop the OLD Telegram poller first (token conflict with OpenClaw):
sudo systemctl disable --now assistant-telegram-bot.service

sudo cp deployment/systemd/*.service deployment/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now assistant-api.service      # replaces the old unit
sudo systemctl enable --now openclaw-gateway.service
sudo systemctl enable --now assistant-digest.timer
```

## Verify

```bash
systemctl status assistant-api openclaw-gateway
curl -s http://127.0.0.1:3010/health          # -> {"ok":true}
journalctl -u openclaw-gateway -f             # Telegram connected + plugin loaded
systemctl list-timers assistant-digest.timer  # next digest run

# digest manual checks
sudo systemctl start assistant-digest.service                  # real send now
cd assistant && node dist/src/jobs/run-daily-digest-cli.js --dry-run   # no send
```

### Telegram round-trip (LLM + bridge tool)
From the allowlisted chat (`tg:8333411467`):
1. "assistant.health 실행해줘" → backend `{ok:true}` 확인 (bridge → API 동작)
2. "이 아이디어 저장해줘: ..." → `assistant.save_note` → Obsidian 저장 확인
3. 아무 질문 → LLM 응답 확인

## Updating

```bash
cd /home/junn1370/personal_assistant && git pull
cd assistant && npm ci && npm run build && cd ..
cd openclaw/plugins/assistant-bridge && npm ci && npm run build && cd -
sudo systemctl restart assistant-api openclaw-gateway
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Gateway exits / config error | `OPENCLAW_CONFIG_PATH` → `openclaw.gcp.json`; plugin path matches actual dir |
| Bot doesn't reply | `allowFrom` = `tg:$TELEGRAM_CHAT_ID`; no second poller on the token |
| Bridge tool fails | `ASSISTANT_BASE_URL=http://127.0.0.1:3010`; `assistant-api` running |
| `SQLite is experimental` warning | harmless; needs Node ≥ 22.5 |
| Wrong digest time | set server TZ or use `OnCalendar=Asia/Seoul 08:00` (systemd ≥ 252) |

> OpenClaw can also self-manage the service: `openclaw gateway install` /
> `openclaw gateway status`. The hand-written units above are the explicit,
> reviewable alternative used here.
