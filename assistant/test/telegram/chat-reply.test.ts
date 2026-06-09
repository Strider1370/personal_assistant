import { describe, expect, test } from "vitest";

import { createChatReply, shouldUseWebSearch } from "../../src/telegram/chat-reply.js";
import type { AppConfig } from "../../src/shared/config.js";

const config: AppConfig = {
  obsidianVaultPath: "C:\\vault",
  assistantPort: 3010,
  assistantDbPath: "C:\\assistant\\data\\assistant.db",
  llmProvider: "test",
  llmBaseUrl: "https://llm.example.com/v1",
  llmApiKey: "test-key",
  llmModel: "test-model",
  llmEnableThinking: false,
  notionToken: "test-notion-token",
  notionDatabaseId: "test-database-id",
  telegramBotToken: "test-telegram-token",
  telegramChatId: "12345",
  digestTimezone: "Asia/Seoul"
};

describe("shouldUseWebSearch", () => {
  test("detects explicit Korean search intent", () => {
    expect(shouldUseWebSearch("이거 인터넷으로 검색해줘. 오늘 나온 소식도 포함해줘")).toBe(true);
  });

  test("detects recency-sensitive questions", () => {
    expect(shouldUseWebSearch("OpenAI 지금 CEO 누구야?")).toBe(true);
  });

  test("keeps ordinary chat on direct LLM mode", () => {
    expect(shouldUseWebSearch("이 메모를 조금 더 짧게 바꿔줘")).toBe(false);
  });
});

describe("createChatReply", () => {
  test("uses web search results for search-mode prompts and returns cited answer", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);

      if (url.startsWith("https://html.duckduckgo.com/html/")) {
        return new Response(
          [
            "<html><body>",
            '<a class="result__a" href="https://example.com/openai-ceo">OpenAI CEO update</a>',
            '<a class="result__snippet">Sam Altman remains CEO as of the latest company update.</a>',
            "</body></html>"
          ].join(""),
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "검색 결과 기준으로 Sam Altman이 CEO입니다.\n출처:\n- https://example.com/openai-ceo"
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const reply = await createChatReply("OpenAI 지금 CEO 누구야? 인터넷으로 검색해줘.", config, fetchImpl);

    expect(calls[0]).toContain("https://html.duckduckgo.com/html/?q=");
    expect(calls[1]).toBe("https://llm.example.com/v1/chat/completions");
    expect(reply).toContain("Sam Altman");
    expect(reply).toContain("https://example.com/openai-ceo");
  });

  test("decodes DuckDuckGo redirect links into direct source URLs", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("https://html.duckduckgo.com/html/")) {
        return new Response(
          [
            "<html><body>",
            '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdecoded">Decoded source</a>',
            '<a class="result__snippet">Decoded snippet</a>',
            "</body></html>"
          ].join(""),
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "검색 결과 기준 답변입니다."
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const reply = await createChatReply("OpenAI 최신 정보 검색해줘", config, fetchImpl);

    expect(reply).toContain("https://example.com/decoded");
    expect(reply).not.toContain("//duckduckgo.com/l/");
  });

  test("falls back to direct LLM mode for non-search prompts", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "짧게 정리한 답변입니다."
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const reply = await createChatReply("이 문장을 더 간단히 바꿔줘", config, fetchImpl);

    expect(calls).toEqual(["https://llm.example.com/v1/chat/completions"]);
    expect(reply).toBe("짧게 정리한 답변입니다.");
  });

  test("appends sources when the model omits them in search mode", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.startsWith("https://html.duckduckgo.com/html/")) {
        return new Response(
          [
            "<html><body>",
            '<a class="result__a" href="https://example.com/source-1">Source one</a>',
            '<a class="result__snippet">Snippet one</a>',
            '<a class="result__a" href="https://example.com/source-2">Source two</a>',
            '<a class="result__snippet">Snippet two</a>',
            "</body></html>"
          ].join(""),
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "검색 결과 기준으로 답변합니다."
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const reply = await createChatReply("검색해서 알려줘. OpenAI CEO 누구야?", config, fetchImpl);

    expect(reply).toContain("검색 결과 기준으로 답변합니다.");
    expect(reply).toContain("출처:");
    expect(reply).toContain("https://example.com/source-1");
  });
});
