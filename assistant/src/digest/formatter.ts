import type { RankedDigestItem } from "./types.js";

export function formatDigest(items: RankedDigestItem[]): string {
  return items
    .map((item, index) =>
      [
        `${index + 1}. ${item.displayTitle ?? item.title}`,
        `출처: ${item.source}`,
        `요약: ${item.summary}`,
        `왜 중요한가: ${item.whyItMatters}`,
        `왜 당신에게 relevant한가: ${item.userRelevance}`,
        item.nextAction ? `다음 행동: ${item.nextAction}` : undefined,
        `링크: ${item.url}`,
        item.relatedNotes && item.relatedNotes.length > 0
          ? `관련 노트: ${item.relatedNotes.map((note) => note.title).join(", ")}`
          : undefined
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}
