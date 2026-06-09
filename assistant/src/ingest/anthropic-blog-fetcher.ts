import type { DigestCandidateFetcher } from "./types.js";
import { deriveDigestTags } from "../digest/relevance.js";
import { parseAtomEntries, parseRssItems } from "./xml.js";

const ANTHROPIC_FEED_URL = "https://www.anthropic.com/news/rss.xml";
const ANTHROPIC_NEWSROOM_URL = "https://www.anthropic.com/news";

export function createAnthropicBlogFetcher(fetchImpl: typeof fetch = fetch): DigestCandidateFetcher {
  return {
    async fetchCandidates() {
      const response = await fetchImpl(ANTHROPIC_FEED_URL);

      if (response.ok) {
        const xml = await response.text();
        const items = parseRssItems(xml);
        const fallback = items.length > 0 ? items : parseAtomEntries(xml);

        return fallback.slice(0, 10).map((item) => ({
          source: "anthropic_blog" as const,
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

      const newsResponse = await fetchImpl(ANTHROPIC_NEWSROOM_URL);

      if (!newsResponse.ok) {
        throw new Error(`Failed to fetch Anthropic newsroom: ${newsResponse.status}`);
      }

      const html = await newsResponse.text();
      return parseAnthropicNewsroom(html);
    }
  };
}

function parseAnthropicNewsroom(html: string) {
  const matches = [...html.matchAll(/<a\b[^>]*href=(["'])(\/news\/[^"'?#\s<>]+)\1[^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set<string>();

  return matches
    .map((match) => ({
      href: match[2],
      title: extractAnchorTitle(match[3])
    }))
    .filter((item) => item.title.length > 0)
    .filter((item) => {
      if (seen.has(item.href)) {
        return false;
      }

      seen.add(item.href);
      return true;
    })
    .slice(0, 10)
    .map((item) => {
      const url = `https://www.anthropic.com${item.href}`;

      return {
        source: "anthropic_blog" as const,
        sourceId: url,
        title: item.title,
        url,
        publishedAt: new Date().toISOString(),
        reactionScore: 0,
        sourceSignals: {
          officialSource: true
        },
        tags: [...deriveDigestTags(`${item.title} ${url}`), "official"]
      };
    });
}

function extractAnchorTitle(anchorHtml: string): string {
  const headingMatch = anchorHtml.match(/<(h[1-6]|strong)\b[^>]*>([\s\S]*?)<\/\1>/i);
  const content = headingMatch ? headingMatch[2] : anchorHtml;

  return decodeHtml(content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
