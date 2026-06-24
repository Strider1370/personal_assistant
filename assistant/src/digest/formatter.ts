import type { RankedDigestItem } from "./types.js";

export function formatDigest(items: RankedDigestItem[]): string {
  return items
    .map((item, index) =>
      [
        `${index + 1}. ${item.displayTitle ?? item.title}`,
        "",
        "요약:",
        item.summary,
        "",
        `출처: ${item.source}`,
        `링크: ${item.url}`
      ].join("\n")
    )
    .join("\n\n");
}
