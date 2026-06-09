import { deriveDigestTags } from "../digest/relevance.js";
import type { DigestCandidateFetcher } from "./types.js";
import { parseAtomEntries, parseRssItems } from "./xml.js";

const GEEK_NEWS_FEED_URL = "https://news.hada.io/rss/news";

export function createGeekNewsFetcher(fetchImpl: typeof fetch = fetch): DigestCandidateFetcher {
  return {
    async fetchCandidates() {
      const response = await fetchImpl(GEEK_NEWS_FEED_URL);

      if (!response.ok) {
        throw new Error(`Failed to fetch GeekNews feed: ${response.status}`);
      }

      const xml = await response.text();
      const items = parseRssItems(xml);
      const fallback = items.length > 0 ? items : parseAtomEntries(xml);

      return fallback.slice(0, 30).map((item) => ({
        source: "geek_news" as const,
        sourceId: item.url,
        title: item.title,
        url: item.url,
        publishedAt: new Date(item.publishedAt || Date.now()).toISOString(),
        reactionScore: 0,
        sourceSignals: {},
        tags: [...deriveDigestTags(`${item.title} ${item.url}`), "korean-curation"]
      }));
    }
  };
}
