# Personal Assistant — Expansion Roadmap

작성일: 2026-06-24. 현재 동작하는 구성(OpenClaw 게이트웨이 + Telegram + Alibaba
LLM + assistant 백엔드 + assistant-bridge 플러그인) 위에서의 확장 방향.

## 설계 원칙
- **새 기능은 가능한 한 `assistant-bridge` 도구로 노출**한다. 그래야 Telegram에서
  LLM 에이전트가 자연어로 호출할 수 있다. (현재 도구: `assistant.save_note`,
  `assistant.structure_note`, `assistant.health`)
- 비즈니스 로직/외부 API 연동은 **assistant 백엔드(Fastify)** 에 둔다. OpenClaw는
  대화·메모리·도구 호출 오케스트레이션만 담당한다.
- 외부 자격증명(Google, Notion 등)은 전부 `.env`/서버 시크릿으로.

---

## 방향 1 — 일정 관리형 (Google Calendar)

**목표:** Telegram으로 "내일 3시 회의 잡아줘" → 일정 생성/수정/조회/알림.

**구현 단계**
1. Google Cloud 프로젝트 + OAuth (서버용은 **service account + domain delegation**
   또는 1회 OAuth refresh token 저장). 토큰은 `.env`:
   `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`.
2. 백엔드: `assistant/src/calendar/google-client.ts` (googleapis) + 라우트
   `POST /calendar/events`, `GET /calendar/events?range=`, `PATCH/DELETE`.
3. 브리지 도구 추가: `assistant.create_event`, `assistant.list_events`,
   `assistant.update_event` → `openclaw.json`의 `tools.allow`와
   `openclaw.plugin.json` contracts에 등록.
4. 알림: 기존 daily digest 잡과 같은 패턴으로 `run-calendar-reminders.ts` cron
   (예: 매시간) → 임박 일정 Telegram 발송 (`telegram/send-message.ts` 재사용).

**난이도/리스크:** OAuth가 가장 큰 작업. 자연어→구조화(날짜 파싱)는 LLM에 맡기되,
백엔드에서 ISO 검증. 타임존은 `DIGEST_TIMEZONE` 재사용.

---

## 방향 2 — 아이디어 저장형 (Obsidian / Notion)

**목표:** Telegram으로 보낸 아이디어를 구조화해 저장·분류·검색. *대부분 이미 존재.*

**현재 가능:** `assistant.save_note`(구조화 후 Obsidian 저장) + Notion sync 잡.

**확장 단계**
1. **자동 분류/태깅 강화:** `note-schema.ts`에 아이디어 카테고리(프로젝트/리서치/
   잡생각) 필드 추가, LLM 프롬프트가 태그 추천.
2. **검색 도구:** `assistant.search_notes`(이미 `note-index.ts` SQLite 인덱스 활용)
   → "지난주 마케팅 아이디어 찾아줘"에 응답. 브리지 도구로 노출.
3. **주간 정리 잡:** `run-idea-review.ts` cron → 한 주 아이디어 묶어 요약 노트 생성
   + Notion 동기화. digest 잡과 동일 배포 패턴(systemd oneshot service + timer).
4. **양방향 Notion:** 현재 Obsidian→Notion 단방향. 필요 시 Notion 변경 pull 추가.

**난이도/리스크:** 낮음 — 기존 컴포넌트 재사용이 많음. 가장 빠른 가치.

---

## 방향 3 — 업무 지원형 (할 일/초안/리서치/digest)

**목표:** 할 일 정리, 문서 초안, 리서치 요약, digest 품질 개선.

**구현 단계**
1. **할 일:** 가벼운 task 테이블(SQLite `migrations.ts`에 추가) +
   `assistant.add_task / list_tasks / complete_task` 도구. Telegram 자연어로 CRUD.
2. **초안 작성:** `assistant.draft`(이메일/공지/메모 템플릿) — LLM 호출만, 저장은
   선택. `model-client.ts` 재사용.
3. **리서치/요약:** OpenClaw `web_search`(이미 allow됨) + `assistant.summarize_url`
   (URL fetch→요약→노트 저장 옵션).
4. **digest 개선:** 현재 ranker/formatter 위에 — 개인화 가중치(자주 저장한 주제),
   소스 추가(RSS 설정 외부화), "왜 골랐는지" 한 줄 사유. `ranker.ts` 확장.

**난이도/리스크:** 중. task 모델은 작고, digest 개선은 점진적.

---

## 우선순위 제안
1. **방향 2(아이디어 저장 + 검색)** — 재사용 최대, 즉시 체감. 1~2일.
2. **방향 3의 할 일 + digest 개선** — 작은 단위로 누적. 2~4일.
3. **방향 1(Calendar)** — OAuth 비용이 크므로 가치 확인 후. 3~5일.

## 새 기능 추가 체크리스트
- [ ] 백엔드 라우트 + 단위 테스트(vitest)
- [ ] 브리지 도구 등록 (`plugins/assistant-bridge/src/tools/*`, `index.ts`)
- [ ] `openclaw.json`(로컬) + `openclaw.gcp.json`(서버)의 `tools.allow` 갱신
- [ ] `openclaw.plugin.json` contracts 갱신
- [ ] typecheck / test / `openclaw plugins inspect` 통과
- [ ] 새 주기 잡이면 systemd oneshot service + `.timer` 추가 + 스케줄 문서화
