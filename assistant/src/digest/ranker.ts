import type { AppConfig } from "../shared/config.js";
import type { DigestItemCandidate, RankedDigestItem } from "./types.js";

export type DigestRanker = {
  rankCandidates(candidates: DigestItemCandidate[]): Promise<RankedDigestItem[]>;
};

const fallbackSummarySuffix = "관련 핵심 업데이트";
const fallbackWhyItMatters = "원문을 직접 확인할 가치가 있는 업데이트입니다.";
const fallbackUserRelevance = "AI 도구 학습 흐름과 맞닿아 있습니다.";
const fallbackNextAction = "링크를 열어 핵심 내용을 확인하세요.";

export function createHeuristicDigestRanker(): DigestRanker {
  return {
    async rankCandidates(candidates) {
      return [...candidates]
        .sort((left, right) => right.reactionScore - left.reactionScore)
        .map((candidate) => ({
          ...candidate,
          displayTitle: candidate.title,
          summary: `${candidate.title} ${fallbackSummarySuffix}`,
          whyItMatters: fallbackWhyItMatters,
          userRelevance: candidate.tags.join(", ") || fallbackUserRelevance,
          nextAction: fallbackNextAction
        }));
    }
  };
}

export function createLlmDigestRanker(
  config: AppConfig,
  fetchImpl: typeof fetch = fetch
): DigestRanker {
  return {
    async rankCandidates(candidates) {
      if (candidates.length === 0) {
        return [];
      }

      const response = await fetchImpl(`${config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.llmApiKey}`
        },
        body: JSON.stringify({
          model: config.llmModel,
          enable_thinking: config.llmEnableThinking,
          temperature: 0.2,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content:
                "You rank digest items for an AI tools learner in Korea. Return JSON { items: [...] } only. Each item must include sourceId, displayTitle, summary, whyItMatters, userRelevance, nextAction. Write displayTitle, summary, whyItMatters, userRelevance, and nextAction in natural Korean. displayTitle should be a Korean-friendly title, not just the original English headline."
            },
            {
              role: "user",
              content: JSON.stringify({ candidates })
            }
          ]
        })
      });

      if (!response.ok) {
        return createHeuristicDigestRanker().rankCandidates(candidates);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        return createHeuristicDigestRanker().rankCandidates(candidates);
      }

      try {
        const parsed = JSON.parse(content) as {
          items?: Array<{
            sourceId: string;
            displayTitle?: string;
            summary: string;
            whyItMatters: string;
            userRelevance: string;
            nextAction?: string;
          }>;
        };

        const candidatesById = new Map(candidates.map((candidate) => [candidate.sourceId, candidate]));
        const rankedIds = new Set<string>();
        const rankedCandidates: RankedDigestItem[] = [];

        for (const rankedItem of parsed.items ?? []) {
          const candidate = candidatesById.get(rankedItem.sourceId);

          if (!candidate) {
            continue;
          }

          rankedIds.add(candidate.sourceId);
          rankedCandidates.push({
            ...candidate,
            displayTitle: rankedItem.displayTitle ?? candidate.title,
            summary: rankedItem.summary,
            whyItMatters: rankedItem.whyItMatters,
            userRelevance: rankedItem.userRelevance,
            nextAction: rankedItem.nextAction
          });
        }

        const remainingCandidates = candidates
          .filter((candidate) => !rankedIds.has(candidate.sourceId))
          .map((candidate) => ({
            ...candidate,
            displayTitle: candidate.title,
            summary: candidate.title,
            whyItMatters: fallbackWhyItMatters,
            userRelevance: candidate.tags.join(", ") || fallbackUserRelevance,
            nextAction: fallbackNextAction
          }));

        return [...rankedCandidates, ...remainingCandidates];
      } catch {
        return createHeuristicDigestRanker().rankCandidates(candidates);
      }
    }
  };
}
