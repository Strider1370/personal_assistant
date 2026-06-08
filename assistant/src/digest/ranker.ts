import type { AppConfig } from "../shared/config.js";
import type { DigestItemCandidate, RankedDigestItem } from "./types.js";

export type DigestRanker = {
  rankCandidates(candidates: DigestItemCandidate[]): Promise<RankedDigestItem[]>;
};

export function createHeuristicDigestRanker(): DigestRanker {
  return {
    async rankCandidates(candidates) {
      return [...candidates]
        .sort((left, right) => right.reactionScore - left.reactionScore)
        .map((candidate) => ({
          ...candidate,
          displayTitle: candidate.title,
          summary: `${candidate.title} 관련 핵심 업데이트`,
          whyItMatters: `${candidate.source} 소스에서 확인된 항목으로 검토 가치가 있습니다.`,
          userRelevance: `${candidate.tags.join(", ") || "일반 AI 학습"} 관심사와 맞닿아 있습니다.`,
          nextAction: `링크를 열어 원문을 확인하세요`
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
        const byId = new Map(parsed.items?.map((item) => [item.sourceId, item]) ?? []);

        return candidates.map((candidate) => {
          const ranked = byId.get(candidate.sourceId);
          return {
            ...candidate,
            displayTitle: ranked?.displayTitle ?? candidate.title,
            summary: ranked?.summary ?? candidate.title,
            whyItMatters:
              ranked?.whyItMatters ?? `${candidate.source} 소스에서 확인된 항목으로 검토 가치가 있습니다.`,
            userRelevance:
              ranked?.userRelevance ??
              `${candidate.tags.join(", ") || "일반 AI 학습"} 관심사와 맞닿아 있습니다.`,
            nextAction: ranked?.nextAction ?? "링크를 열어 원문을 확인하세요"
          };
        });
      } catch {
        return createHeuristicDigestRanker().rankCandidates(candidates);
      }
    }
  };
}
