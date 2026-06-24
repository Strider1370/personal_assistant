import type { AppConfig } from "../shared/config.js";
import type { DigestItemCandidate, RankedDigestItem } from "./types.js";

export type DigestRanker = {
  rankCandidates(candidates: DigestItemCandidate[]): Promise<RankedDigestItem[]>;
};

const fallbackWhyItMatters = "요약 중심 digest에서는 별도 학습 포인트를 출력하지 않습니다.";
const fallbackUserRelevance = "요약 중심 digest에서는 별도 사용자 관련성을 출력하지 않습니다.";
const fallbackNextAction = "원문 링크를 열어 전체 내용을 확인하세요.";

export function createHeuristicDigestRanker(): DigestRanker {
  return {
    async rankCandidates(candidates) {
      return [...candidates]
        .sort((left, right) => right.reactionScore - left.reactionScore)
        .map((candidate) => ({
          ...candidate,
          displayTitle: candidate.title,
          summary: createFallbackSummary(candidate, "LLM 요약을 사용할 수 없어 원문 제목과 출처 신호를 기준으로만 항목을 전달합니다."),
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
                "You rank digest items for an AI tools learner in Korea. Return JSON { items: [...] } only. Each item must include sourceId, displayTitle, summary, whyItMatters, userRelevance, nextAction. Write displayTitle and summary in natural Korean. The summary is the primary output: write 6-10 complete Korean sentences, never more than 10 sentences. Cover what happened, the key change or announcement, useful context, and practical impact. Do not write a short one-line summary. Keep whyItMatters, userRelevance, and nextAction brief because they are retained only for internal compatibility and will not be shown in the digest. displayTitle should be a Korean-friendly title, not just the original English headline."
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
            summary: createFallbackSummary(
              candidate,
              "LLM 응답에 이 항목의 상세 요약이 포함되지 않아 원문 제목을 기준으로 digest에 남겼습니다."
            ),
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

function createFallbackSummary(candidate: DigestItemCandidate, reason: string): string {
  return [
    `${candidate.title} 관련 업데이트입니다.`,
    reason,
    "이 항목은 필터링과 랭킹 과정에서 확인할 가치가 있는 후보로 선택되었습니다.",
    "자세한 변화, 배경 맥락, 실제 영향은 링크의 원문을 확인해야 합니다."
  ].join(" ");
}
