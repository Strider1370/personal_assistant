import type { DigestCandidateFetcher } from "./types.js";
import { deriveDigestTags } from "../digest/relevance.js";
import { parseAtomEntries, parseRssItems } from "./xml.js";

const OPENAI_FEED_URL = "https://openai.com/news/rss.xml";

export function createOpenAiBlogFetcher(fetchImpl: typeof fetch = fetch): DigestCandidateFetcher {
  return {
    async fetchCandidates() {
      const response = await fetchImpl(OPENAI_FEED_URL);

      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAI blog feed: ${response.status}`);
      }

      const xml = await response.text();
      const items = parseRssItems(xml);
      const fallback = items.length > 0 ? items : parseAtomEntries(xml);

      return fallback.slice(0, 10).map((item) => ({
        source: "openai_blog" as const,
        sourceId: item.url,
        title: item.title,
        url: item.url,
        publishedAt: new Date(item.publishedAt || Date.now()).toISOString(),
        reactionScore: 0,
        sourceSignals: {
          officialSource: true
        },
        tags: [...deriveDigestTags(`${item.title} ${item.url}`), "official"]
      }));
    }
  };
}
