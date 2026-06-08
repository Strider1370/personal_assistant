import type { DigestCandidateFetcher } from "./types.js";
import { deriveDigestTags } from "../digest/relevance.js";

const HN_BASE_URL = "https://hacker-news.firebaseio.com/v0";

type HnItem = {
  id: number;
  type?: string;
  title?: string;
  url?: string;
  time?: number;
  score?: number;
  descendants?: number;
};

export function createHackerNewsFetcher(
  fetchImpl: typeof fetch = fetch,
  limit = 20
): DigestCandidateFetcher {
  return {
    async fetchCandidates() {
      const idsResponse = await fetchImpl(`${HN_BASE_URL}/topstories.json`);

      if (!idsResponse.ok) {
        throw new Error(`Failed to fetch Hacker News story ids: ${idsResponse.status}`);
      }

      const ids = ((await idsResponse.json()) as number[]).slice(0, limit);
      const stories = await Promise.all(
        ids.map(async (id) => {
          const response = await fetchImpl(`${HN_BASE_URL}/item/${id}.json`);
          if (!response.ok) {
            return null;
          }
          return (await response.json()) as HnItem;
        })
      );

      return stories
        .filter((story): story is HnItem => Boolean(story?.id && story?.title))
        .filter((story) => story.type === "story")
        .map((story) => ({
          source: "hacker_news" as const,
          sourceId: String(story.id),
          title: story.title ?? "Untitled Hacker News Story",
          url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
          publishedAt: new Date((story.time ?? 0) * 1000).toISOString(),
          reactionScore: (story.score ?? 0) + (story.descendants ?? 0),
          sourceSignals: {
            hnPoints: story.score ?? 0,
            hnComments: story.descendants ?? 0
          },
          tags: deriveDigestTags(`${story.title ?? ""} ${story.url ?? ""}`)
        }));
    }
  };
}
