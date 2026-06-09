import type { AppConfig } from "../shared/config.js";

type FetchLike = typeof fetch;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const SOURCE_LABEL = "\ucd9c\ucc98:";
const explicitSearchKeywords = [
  "\uac80\uc0c9\ud574\uc918",
  "\uac80\uc0c9\ud574\uc11c",
  "\uc778\ud130\ub137\uc73c\ub85c",
  "\uc778\ud130\ub137\uc5d0\uc11c",
  "\uc6f9\uc5d0\uc11c",
  "latest",
  "search",
  "look up"
];
const recencyKeywords = [
  "\ucd5c\uc2e0",
  "\uc624\ub298",
  "\uc9c0\uae08",
  "\ud604\uc7ac",
  "\uc694\uc998",
  "recent",
  "today",
  "now",
  "current"
];
const normalizedQueryPatterns = [
  /\uac80\uc0c9\ud574\uc918/gi,
  /\uac80\uc0c9\ud574\uc11c/gi,
  /\uc778\ud130\ub137\uc73c\ub85c/gi,
  /\uc778\ud130\ub137\uc5d0\uc11c/gi,
  /\uc6f9\uc5d0\uc11c/gi
];

export async function createChatReply(
  userText: string,
  config: AppConfig,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  if (!shouldUseWebSearch(userText)) {
    return createDirectReply(userText, config, fetchImpl);
  }

  const searchResults = await searchWeb(userText, fetchImpl);

  if (searchResults.length === 0) {
    return "Web search did not return any usable results. Please send a more specific query.";
  }

  return createSearchReply(userText, searchResults, config, fetchImpl);
}

export function shouldUseWebSearch(userText: string): boolean {
  const lowered = userText.toLowerCase();

  if (explicitSearchKeywords.some((keyword) => lowered.includes(keyword))) {
    return true;
  }

  return recencyKeywords.some((keyword) => lowered.includes(keyword));
}

export function parseDuckDuckGoResults(html: string): SearchResult[] {
  const anchors = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)];
  const results: SearchResult[] = [];

  for (const [index, match] of anchors.entries()) {
    const url = normalizeSearchResultUrl(decodeHtml(match[1]));
    const title = stripTags(match[2]);
    const snippet = stripTags(snippets[index]?.[1] ?? "");

    if (!url || !title) {
      continue;
    }

    results.push({
      title,
      url,
      snippet
    });
  }

  return results;
}

async function createDirectReply(
  userText: string,
  config: AppConfig,
  fetchImpl: FetchLike
): Promise<string> {
  const response = await fetchImpl(`${config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llmApiKey}`
    },
    body: JSON.stringify({
      model: config.llmModel,
      enable_thinking: config.llmEnableThinking,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "You are a personal AI assistant on Telegram. Reply in Korean using 2-5 plain sentences."
        },
        {
          role: "user",
          content: userText
        }
      ]
    })
  });

  if (!response.ok) {
    return `Reply generation failed. Status: ${response.status}`;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  return content || "The assistant could not generate a reply.";
}

async function createSearchReply(
  userText: string,
  searchResults: SearchResult[],
  config: AppConfig,
  fetchImpl: FetchLike
): Promise<string> {
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
      messages: [
        {
          role: "system",
          content: `You answer only from supplied web search results. If the answer is not supported by the results, say you do not know. Reply in Korean using 2-5 sentences. End with a '${SOURCE_LABEL}' line and up to 3 links.`
        },
        {
          role: "user",
          content: JSON.stringify({
            question: userText,
            searchResults
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return `Search-based reply generation failed. Status: ${response.status}`;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  return appendSources(content || "The assistant could not build a search-based reply.", searchResults);
}

async function searchWeb(query: string, fetchImpl: FetchLike): Promise<SearchResult[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", normalizeSearchQuery(query));

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "text/html"
    }
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  return parseDuckDuckGoResults(html).slice(0, 5);
}

function normalizeSearchQuery(query: string): string {
  let normalized = query;

  for (const pattern of normalizedQueryPatterns) {
    normalized = normalized.replace(pattern, " ");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function appendSources(content: string, searchResults: SearchResult[]): string {
  if (content.includes(SOURCE_LABEL)) {
    return content;
  }

  const links = searchResults
    .slice(0, 3)
    .map((result) => `- ${result.url}`)
    .join("\n");

  if (!links) {
    return content;
  }

  return `${content}\n${SOURCE_LABEL}\n${links}`;
}

function normalizeSearchResultUrl(url: string): string {
  const candidate = url.startsWith("//") ? `https:${url}` : url;

  try {
    const parsed = new URL(candidate);
    const redirected = parsed.searchParams.get("uddg");

    return redirected ? decodeURIComponent(redirected) : candidate;
  } catch {
    return candidate;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
