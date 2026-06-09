import { describe, expect, test } from "vitest";

import { createLlmDigestRanker } from "../../src/digest/ranker.js";
import type { DigestItemCandidate } from "../../src/digest/types.js";
import type { AppConfig } from "../../src/shared/config.js";

const config: AppConfig = {
  obsidianVaultPath: "C:\\vault",
  assistantPort: 3010,
  assistantDbPath: "C:\\db\\assistant.db",
  llmProvider: "test",
  llmBaseUrl: "https://example.com/v1",
  llmApiKey: "test-key",
  llmModel: "test-model",
  llmEnableThinking: false,
  notionToken: "test-notion-token",
  notionDatabaseId: "test-database-id",
  telegramBotToken: "test-telegram-token",
  telegramChatId: "12345",
  digestTimezone: "Asia/Seoul"
};

function makeCandidate(sourceId: string, title: string): DigestItemCandidate {
  return {
    source: "openai_blog",
    sourceId,
    title,
    url: `https://example.com/${sourceId}`,
    publishedAt: "2026-06-09T00:00:00Z",
    reactionScore: 0,
    sourceSignals: {
      officialSource: true
    },
    tags: ["ai", "official"]
  };
}

describe("createLlmDigestRanker", () => {
  test("returns items in the LLM-provided ranking order", async () => {
    const candidates = [
      makeCandidate("first", "First item"),
      makeCandidate("second", "Second item"),
      makeCandidate("third", "Third item")
    ];
    const ranker = createLlmDigestRanker(config, async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      sourceId: "third",
                      displayTitle: "Third ranked",
                      summary: "third summary",
                      whyItMatters: "third matters",
                      userRelevance: "third relevant",
                      nextAction: "read third"
                    },
                    {
                      sourceId: "first",
                      displayTitle: "First ranked",
                      summary: "first summary",
                      whyItMatters: "first matters",
                      userRelevance: "first relevant",
                      nextAction: "read first"
                    }
                  ]
                })
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    const ranked = await ranker.rankCandidates(candidates);

    expect(ranked.map((item) => item.sourceId)).toEqual(["third", "first", "second"]);
    expect(ranked[0]?.displayTitle).toBe("Third ranked");
    expect(ranked[1]?.displayTitle).toBe("First ranked");
    expect(ranked[2]?.displayTitle).toBe("Second item");
  });
});
