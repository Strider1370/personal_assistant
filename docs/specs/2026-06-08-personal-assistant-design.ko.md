# 개인 비서 설계

## 목적

두 가지 초기 기능을 가진 개인 비서 시스템을 만든다.

- 자유로운 생각을 구조화된 Obsidian 노트로 바꿔주는 메모 비서
- 매일 AI/LLM 브리핑을 보내고, 이후 기존 메모와 연결할 수 있는 학습/리서치 비서

이 설계는 저비용 메모 구조화와 고품질 브레인스토밍을 의도적으로 분리한다. 가벼운 메모 정리는 `Qwen` 같은 저가형 모델을 쓰고, 더 깊은 아이디어 정리는 `ChatGPT`에서 진행한 뒤 사용자가 명시적으로 승인하면 `Notion`에 저장하고, 서버가 이를 `Obsidian`으로 동기화한다.

## 사용자 목표

이 시스템은 사용자가 다음 일을 더 쉽게 하도록 돕는다.

- 미리 형식을 맞추지 않고도 어수선한 생각을 바로 기록한다.
- 원문 생각을 제목, 요약, 태그, 관련 메모 후보가 있는 정돈된 노트 초안으로 바꾼다.
- 고품질 브레인스토밍은 ChatGPT로 진행하고, 승인된 결과를 Notion에 저장한 뒤 Obsidian으로 동기화한다.
- AI/LLM 업데이트, 코딩 에이전트 도구, 플러그인, 스킬, 워크플로, 흥미로운 데이터셋/페르소나 관련 짧은 일일 브리핑을 받는다.
- 시간이 지나면서 새로운 외부 정보를 기존 노트 베이스와 연결한다.

## 확정된 제품 결정

- 첫 번째 릴리스는 두 개의 비서 트랙으로 구성한다.
  - 가벼운 메모 구조화
  - 학습/리서치 브리핑
- 가벼운 메모 구조화는 `Qwen` 같은 저가형 모델을 사용한다.
- 브레인스토밍은 저가형 모델이 아니라 `ChatGPT`를 사용한다.
- 브레인스토밍 노트는 사용자가 명시적으로 `save`라고 말했을 때만 다음 단계로 넘긴다.
- 승인된 브레인스토밍 결과는 먼저 Notion에 저장하고, 이후 백엔드가 Obsidian으로 동기화한다.
- `Obsidian`을 표준 노트 저장소로 사용한다.
- MVP 저장 대상은 GCP 서버의 vault를 기준으로 하되, 나중에 로컬 vault 동기화를 막지 않아야 한다.
- 저장되는 노트는 모두 먼저 `Inbox/`로 보낸다.
- MVP에서는 자동 폴더 분류를 하지 않는다. 대신 노트 타입은 frontmatter에 저장한다.
- 학습 비서의 MVP 소스는 다음 세 가지다.
  - Hacker News
  - OpenAI 공식 블로그
  - Anthropic 공식 블로그
- 일일 학습 출력은 짧게 유지하고, 3~5개 항목만 보낸다.
- 학습 항목 선정은 두 단계 필터를 사용한다.
  - 커뮤니티 반응 신호 또는 공식 소스 포함 여부
  - 사용자의 관심사에 맞는 LLM relevance scoring
- 관련 메모 추천은 먼저 태그 기반으로 후보를 추리고, 그 다음 LLM이 최종 후보를 고른다.
- MVP는 ChatGPT Actions나 공개 HTTPS save endpoint를 전제로 하지 않는다.

## 범위

### MVP 범위에 포함

- 다음을 호스팅하는 단일 백엔드 서비스
  - note save API for internal/manual use
  - 가벼운 메모 구조화용 엔드포인트 또는 잡
  - Notion sync ingestion
  - 예약된 학습 비서 잡
  - Telegram 연동
- Obsidian 마크다운 노트 생성
- Notion-to-Obsidian sync for approved brainstorming notes
- 일일 학습 digest 생성
- digest용 dedupe/state 영속화
- 저장된 노트 메타데이터를 활용한 기본 관련 메모 추천

### MVP 범위에서 제외

- ChatGPT Actions 연동
- 완전한 Obsidian 양방향 동기화 프로토콜
- `Inbox/`에서 영구 폴더로 자동 이동
- 전체 semantic search/vector database
- Gmail, Slack, Calendar, finance 연동
- 다중 사용자 인증
- 풍부한 웹 UI
- 전용 모바일/데스크톱 앱

## 아키텍처

시스템은 하나의 TypeScript 백엔드 안에 세 개의 논리 모듈을 둔다.

1. `note-structuring`
   - 원문 텍스트를 받는다.
   - `Qwen`을 호출한다.
   - 구조화된 노트 초안을 만든다.

2. `notion-sync`
   - 승인된 브레인스토밍 초안을 Notion에서 읽는다.
   - webhook 또는 polling으로 변경을 감지한다.
   - 승인된 Notion 콘텐츠를 Obsidian markdown으로 변환한다.
   - Obsidian vault에 markdown을 저장한다.

3. `learning-digest`
   - HN과 공식 블로그에서 소스 항목을 가져온다.
   - 후보를 필터링한다.
   - LLM으로 순위를 매기고 요약한다.
   - Telegram 브리핑을 보낸다.
   - 선택적으로 브리핑을 Obsidian에 저장한다.

```text
Telegram / 사용자 텍스트
    -> note-structuring
    -> Qwen
    -> 구조화된 노트 초안
    -> Obsidian에 저장하거나 미리보기 반환

ChatGPT 브레인스토밍
    -> 사용자 승인 ("save")
    -> 승인된 초안이 Notion에 저장됨
    -> 백엔드가 Notion 변경을 읽음
    -> markdown가 Obsidian vault에 저장됨

HN + OpenAI + Anthropic
    -> source fetchers
    -> popularity / official-source filter
    -> LLM ranking + summary
    -> Telegram digest
    -> 선택적 Obsidian digest note
```

## 추천 기술 스택

- Runtime: `Node.js`
- Language: `TypeScript`
- HTTP API: `Fastify`
- Validation: `zod`
- Scheduler: 시스템 `cron` + 앱 내부 job entrypoint
- Bot integration: `Telegraf`
- State store: `SQLite`
- Note storage: Obsidian vault 내 파일시스템 markdown
- Notion integration: Notion API + webhook 또는 polling 지원
- Feed parsing: RSS parser + 필요 시 가벼운 HTML 파싱
- Date utilities: `date-fns` 또는 `dayjs`

이 스택을 추천하는 이유는 이 프로젝트가 ML 중심 시스템보다는 API, 자동화, 연동 중심 시스템에 가깝기 때문이다. 봇 로직, 예약 잡, 노트 생성, sync logic, HTTP endpoint를 하나의 코드베이스에서 관리하기 쉽다.

## 데이터 모델

### 구조화된 노트 초안

저장 전 모든 노트 초안은 아래 형태로 정규화한다.

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

### 저장된 노트의 markdown 형식

저장되는 노트는 frontmatter가 있는 markdown을 사용한다.

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

노트는 다음 경로 규칙으로 저장한다.

```text
<vault>/Inbox/YYYY-MM-DD-<slug>.md
```

MVP에서는 `Ideas/`, `Research/` 같은 폴더로 자동 이동하지 않는다. 나중 분류를 위해 `type` frontmatter만 넣어두면 충분하다.

일일 digest 보관 기능을 켜는 경우에도 저장 위치는 먼저 `Inbox/`를 따라야 한다. 이때는 `digest: true` 같은 frontmatter를 넣거나, 필요하면 타입 체계를 구현 시점에 확장한다. MVP에서는 `Learning/` 같은 별도 저장 경로로 `Inbox/` 규칙을 우회하지 않는다.

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

## 메모 비서 설계

### 가벼운 메모 경로

이 경로는 빠른 캡처와 저비용 구조화를 위한 것이다.

입력 예시:

- 짧은 자유 텍스트
- Telegram 메시지
- 붙여넣은 메모 조각

흐름:

1. 원문 텍스트를 받는다.
2. `Qwen`에게 `idea`, `note`, `task`, `research` 중 하나로 분류하게 한다.
3. `Qwen`에게 다음 값을 반환하게 한다.
   - title
   - summary
   - 2~5개 bullet point
   - 가능하면 reflection
   - 2~5개 tags
4. 서버 쪽에서 결과를 검증한다.
5. 호출 흐름에 따라 바로 저장하거나, 초안을 미리보기로 돌려준다.

이 경로는 깊은 추론보다는 저지연, 저비용을 목표로 한다.

MVP에서는 이 경로가 저가형 모델 클래스만 사용해야 한다. 여기서는 ChatGPT를 호출하지 않는다.

### 브레인스토밍 경로

이 경로는 모호하거나 중요한 아이디어를 다룰 때 사용한다. 비용보다 대화 품질이 중요하다.

흐름:

1. 사용자가 ChatGPT에서 브레인스토밍한다.
2. ChatGPT가 생각을 구조화된 초안으로 정리한다.
3. ChatGPT가 합의된 노트 형식으로 초안을 보여준다.
4. 사용자가 명시적으로 `save`라고 말한다.
5. 승인된 초안을 미리 정한 Notion page/database 형식으로 저장한다.
6. 백엔드가 webhook 또는 polling으로 새 Notion 항목을 감지한다.
7. 백엔드가 해당 Notion 콘텐츠를 합의된 markdown 노트 형식으로 변환한다.
8. 백엔드가 Obsidian vault에 노트를 저장하고 sync 결과를 기록한다.

이 경로의 ChatGPT 지침에는 다음이 반드시 들어가야 한다.

- 사용자가 `save`라고 명시하지 않으면 절대 다음 단계로 넘기지 않는다.
- handoff 전에 항상 정돈된 구조화 초안을 먼저 보여준다.
- 명시적 승인 후에는 Notion에 넣기 좋은 save-ready draft를 만든다.
- 백엔드 sync가 끝나기 전에는 이미 Obsidian에 저장된 것처럼 말하지 않는다.

## Notion Sync 연동

### 목표

ChatGPT로 만든 브레인스토밍 결과를 먼저 Notion에 두고, 이후 사용자의 백엔드가 이를 Obsidian으로 동기화할 수 있게 한다.

### 지원 메커니즘

Notion은 승인된 브레인스토밍 초안의 중간 저장소 역할을 한다. 백엔드는 Notion API를 통해 변경된 page를 읽고, 가능하면 webhook을 사용하며, MVP-safe fallback으로는 polling을 사용한다.

### 필요한 구성 요소

- Notion integration token
- 승인된 브레인스토밍 초안을 저장할 target Notion database 또는 안정적인 page 규칙
- 아래 둘 중 하나
  - Notion webhook delivery to backend
  - target database/page 집합을 읽는 scheduled polling
- Notion 필드/블록과 구조화 markdown 형식 사이의 매핑 규칙

### MVP Notion 모델

Notion에 저장할 추천 필드:

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

백엔드는 명시적으로 저장 승인된 항목만 동기화해야 한다.

### Sync 동작

서버는 다음을 수행해야 한다.

1. 승인된 Notion entry를 읽는다.
2. 매핑된 데이터를 검증한다.
3. title slug를 만든다.
4. markdown를 생성한다.
5. `<vault>/Inbox/...`에 쓴다.
6. Notion item을 synced 상태로 표시하거나 SQLite에 sync record를 남긴다.

sync 시점에는 빠진 필드를 서버가 임의로 메우지 말고, 불완전한 mapped data는 거절해야 한다.

### 저장 안전 규칙

구현 시 아래 규칙을 명시해야 한다.

- `OBSIDIAN_VAULT_PATH`는 절대 경로여야 한다.
- 모든 쓰기 작업은 그 vault root 아래에서만 일어나야 한다.
- 호출자가 임의의 상대 경로를 제출할 수 있으면 안 된다.
- 파일명은 날짜 + slug 조합으로만 생성한다.
- 중복 파일명은 `-2`, `-3` 같은 결정론적 suffix를 붙이거나, idempotency key를 사용해 처리한다.
- 같은 승인 초안에 대한 반복 Notion sync 시도가 조용히 중복 노트를 대량 생성하면 안 된다.
- 쓰기는 atomic해야 한다. 예를 들어 temp file 작성 후 rename.
- frontmatter와 markdown 텍스트는 YAML이 깨지지 않도록 escape/sanitize해야 한다.
- 노트는 UTF-8로 안전하게 보존해야 한다.

### Notion sync 안전 규칙

구현 시 다음도 명시해야 한다.

- 어떤 Notion database 또는 page 집합이 authoritative 한지
- approval이 Notion에서 어떻게 표현되는지
- `synced_to_obsidian`가 어떻게 표현되는지
- webhook delivery와 polling 중 무엇을 우선할지
- page id + revision 또는 timestamp로 duplicate sync attempt를 어떻게 감지할지

### 로컬 동기화 친화적 추상화

MVP는 서버 vault를 기준으로 하지만, writer 구현은 GCP 전용 경로를 하드코딩하지 말고 하나의 vault path abstraction 위에서 동작해야 한다. 그래야 나중에 로컬 sync나 mirror vault를 지원할 때 스키마를 바꾸지 않아도 된다.

## 학습 비서 설계

### 목표

다음 주제에 초점을 맞춘 짧은 일일 브리핑을 보낸다.

- LLM 업데이트
- 코딩 에이전트 개선
- 바이브 코딩용 플러그인, 스킬, 워크플로
- 실용적으로 흥미로운 새로운 기술, 데이터셋, 페르소나

### 소스 전략

MVP 소스:

- Hacker News
- OpenAI 공식 블로그
- Anthropic 공식 블로그

Hacker News는 반응 신호와 커뮤니티 relevance를 제공한다. 공식 블로그는 커뮤니티 투표 신호가 없어도 정식 제품 업데이트를 담아준다.

MVP의 모델 사용 원칙으로, digest 필터링/랭킹 경로는 품질 문제가 확인되기 전까지 가벼운 메모 구조화와 같은 저가형 모델 클래스를 우선 사용한다. 백엔드 digest 처리에 ChatGPT를 기본값으로 두지는 않는다.

### 후보 필터링

#### 1단계: 소스별 후보 선정

`Hacker News`:

- 일정 lookback window 안의 top 또는 best stories 사용
- points와 comments 기준 이상인 항목만 유지
- 오래된 글은 decay를 적용해 stale story가 덜 올라오게 함

`OpenAI`, `Anthropic`:

- 새 공식 글은 자동 후보 포함
- 이미 보낸 항목과 dedupe

#### 2단계: LLM 주제 적합성 필터

LLM은 다음 주제를 우선해야 한다.

- 새로운 LLM 출시나 업데이트
- coding agent
- 개발자용 plugin, skill, MCP, workflow
- 코딩/디자인 결과물을 개선하는 도구
- 흥미로운 데이터, 페르소나, 실용적인 실험

LLM은 다음 항목의 우선순위를 낮춰야 한다.

- 투자/금융 뉴스
- 직접 활용도가 낮은 순수 학술 내용
- 실질적인 기능 변화가 없는 일반 PR 발표
- 같은 사건의 중복 보도

#### 3단계: 랭킹

각 후보는 아래 값을 기준으로 점수를 받는다.

- reaction signal
- 직접적인 실사용성
- 바이브 코딩 관련성
- 신규성
- 연구 중심이 아닌 사용자가 읽기 쉬운지
- 특이한 도구/데이터/페르소나에 대한 흥미도

구현 순서는 아래와 같아야 한다.

1. source fetch
2. reaction signal 또는 official inclusion을 사용하는 소스별 후보 선정
3. 줄어든 후보 집합에 대한 LLM relevance filter
4. source signal과 LLM-derived usefulness field를 함께 쓰는 최종 ranking

### 일일 출력

digest는 3~5개 항목으로 구성한다.

각 항목은 다음 내용을 포함한다.

- 제목
- 한 줄 요약
- 왜 중요한지
- 이 사용자에게 왜 중요한지
- 지금 해볼 수 있는 다음 액션 1개
- 원문 링크

### 전달

기본 전달 경로:

- 하루 한 번 Telegram 메시지

선택적 영속화:

- 그날의 digest를 Obsidian에 저장

## 관련 메모 추천

### 목표

학습 비서가 새 항목을 보여줄 때, 태그 기반 후보가 있다면 1~3개의 관련 기존 노트를 함께 보여주도록 시도한다. 신뢰할 만한 후보가 없으면 빈 결과도 허용한다.

### MVP 로직

1. digest item의 태그를 추출한다.
2. 저장된 note metadata에서 태그가 겹치는 후보를 찾는다.
3. 작은 후보 집합을 만든다.
4. LLM에게 그 후보 중 가장 관련 있는 1~3개를 고르게 한다.
5. 각 선택된 노트에 한 줄 이유를 붙여 반환한다.

이 방식은 pure tag matching보다 품질이 좋고, MVP에서 full vector-search 시스템을 넣지 않아도 된다.

MVP에서는 이 최종 관련 메모 선택도 우선 저가형 백엔드 모델 클래스를 사용한다. 이후 이유 품질이나 매칭 품질이 부족하다고 판단되면 더 고품질 모델로 교체할 수 있다.

### 왜 아직 embeddings를 쓰지 않는가

Embedding과 vector search는 나중에 유용할 가능성이 높다. 하지만 MVP에서는 인프라와 retrieval complexity를 늘린다. 현재 합의된 MVP는 아래 정도로 단순하게 유지한다.

- note metadata file scan
- candidate filter
- LLM final match

## 저장소와 상태 관리

### Filesystem

- GCP 서버의 Obsidian vault 디렉터리
- `Inbox/` 아래 저장되는 markdown note files
- digest 보관이 있더라도 `Inbox/` 아래 frontmatter로 식별

### SQLite

SQLite는 다음을 추적한다.

- 이미 본 source item
- 이미 보낸 digest item
- source fetch timestamp
- tag/title lookup용 note index cache
- notion sync 상태와 dedupe 정보

추천 테이블:

- `source_items`
- `sent_digests`
- `note_index`
- `notion_sync`
- `jobs`

## 보안과 운영

### 비밀 정보

환경 변수로 저장한다.

- Telegram bot token
- Qwen API key
- Notion integration token
- Notion database 또는 page identifiers
- 필요 시 백엔드가 OpenAI를 직접 호출할 때의 OpenAI API key

### Notion 연동 보호

webhook을 사용할 경우 백엔드는 들어오는 Notion webhook request를 검증해야 하며, Notion token은 필요한 최소 workspace/database 권한만 가져야 한다.

### 로깅

다음을 로그로 남긴다.

- save attempt
- save failure
- notion sync attempt
- notion sync failure
- digest run start/end
- source fetch failure
- LLM parsing failure

raw secret은 로그로 남기지 않는다.

### 스케줄링 동작

digest job은 다음을 명시해야 한다.

- 명확한 timezone
- 각 실행의 lookback window
- 강한 후보가 3개 미만일 때 어떻게 처리할지
- 항목이 없거나 너무 적은 날에는 “오늘은 보낼 만한 게 없음” 메시지를 보낼지, 아예 전달을 건너뛸지

MVP에서는 이 행동 중 하나를 확정하고 테스트해야 한다. 암묵적으로 두지 않는다.

## 프로젝트 구조

추천 레이아웃:

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

이 assistant 서비스는 저장소 루트의 새 top-level 디렉터리로 두는 것이 좋다. 그래야 기존 항공 날씨 대시보드 코드와 책임이 섞이지 않는다.

## 검증

구현은 다음으로 검증해야 한다.

- TypeScript typecheck
- note rendering과 save validation에 대한 backend 테스트
- source dedupe와 ranking input에 대한 backend 테스트
- 비운영 vault를 대상으로 한 수동 Notion-to-Obsidian sync 테스트 1회
- 수동 Telegram digest 전달 테스트 1회
- 다음을 포함하는 end-to-end dry run 1회
  - 승인된 브레인스토밍 노트 1개 저장
  - digest 1회 생성
  - 관련 메모 후보 1개 이상 연결
- Notion webhook 또는 polling sync 테스트 1회
- duplicate-save/idempotency 테스트 1회
- vault-path safety 테스트 1회
- deterministic digest-ranking fixture 테스트 1회
- 빈 날 또는 저품질 후보만 있는 날 테스트 1회

핵심 acceptance check:

- 사용자가 명시적으로 `save`라고 말하지 않으면 ChatGPT는 브레인스토밍 노트를 다음 단계로 넘기지 않는다.
- 저장된 노트는 유효한 frontmatter와 함께 `Inbox/`에 들어간다.
- `Qwen` 노트 초안은 항상 공통 schema로 정규화된다.
- 승인된 Notion 항목은 Obsidian에 정확히 한 번 동기화되거나, 재시도 가능하더라도 중복 폭증 없이 안전해야 한다.
- digest 후보는 실행 간 dedupe가 정확해야 한다.
- 일일 digest는 3~5개 항목을 유지한다.
- HN 반응 신호는 LLM filtering 전에 source-specific candidate selection에 영향을 주고, 최종 ranking의 입력으로도 남는다.
- tag 기반 후보가 존재하면 관련 메모 추천 로직이 실행되어야 하며, 최종 매치가 없어서 빈 결과가 나오는 것은 허용한다.
- Notion sync 경로가 문서화되고 테스트 가능해야 한다.

## 롤아웃 계획

### Phase 1

- backend skeleton
- markdown note save API
- SQLite state store
- Qwen lightweight note structuring

### Phase 2

- Notion integration setup
- Notion-to-Obsidian sync path
- 수동 end-to-end brainstorming save verification

### Phase 3

- HN + OpenAI + Anthropic fetcher
- ranking 및 digest formatting
- Telegram delivery

### Phase 4

- related-note recommendation
- 선택적 digest archival into Obsidian

## 이 설계에서 해결된 주요 질문

- 저장 대상: 로컬과 서버 vault 둘 다 장기적으로 지원 가능해야 하지만, MVP는 서버 vault를 기준으로 한다.
- 저장 트리거: 사용자 명시 승인만 허용한다.
- 폴더 라우팅: `Inbox/`에 저장하고, note type은 frontmatter에 넣는다.
- 모델 분리: 가벼운 구조화는 `Qwen`, 브레인스토밍은 `ChatGPT`, 승인된 브레인스토밍 handoff 저장소는 `Notion`.
