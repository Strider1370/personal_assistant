type ParsedFeedItem = {
  title: string;
  url: string;
  publishedAt: string;
};

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function matchTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

export function parseRssItems(xml: string): ParsedFeedItem[] {
  const matches = [...xml.matchAll(/<item\b[\s\S]*?>([\s\S]*?)<\/item>/gi)];

  return matches
    .map((match) => match[1])
    .map((block) => ({
      title: matchTag(block, "title"),
      url: matchTag(block, "link"),
      publishedAt: matchTag(block, "pubDate")
    }))
    .filter((item) => item.title && item.url);
}

export function parseAtomEntries(xml: string): ParsedFeedItem[] {
  const matches = [...xml.matchAll(/<entry\b[\s\S]*?>([\s\S]*?)<\/entry>/gi)];

  return matches
    .map((match) => match[1])
    .map((block) => {
      const linkMatch = block.match(/<link[^>]+href=(["'])(.*?)\1/i);

      return {
        title: matchTag(block, "title"),
        url: linkMatch ? decodeXml(linkMatch[2]) : "",
        publishedAt: matchTag(block, "updated") || matchTag(block, "published")
      };
    })
    .filter((item) => item.title && item.url);
}
