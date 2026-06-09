import { describe, expect, test } from "vitest";

import { createAnthropicBlogFetcher } from "../../src/ingest/anthropic-blog-fetcher.js";
import { createGeekNewsFetcher } from "../../src/ingest/geek-news-fetcher.js";

describe("feed fetchers", () => {
  test("GeekNews fetcher parses Atom feeds", async () => {
    const atomXml = [
      "<?xml version='1.0' encoding='UTF-8'?>",
      "<feed xmlns='http://www.w3.org/2005/Atom'>",
      "  <entry>",
      "    <title><![CDATA[Agent engineering update]]></title>",
      "    <link rel='alternate' type='text/html' href='https://news.hada.io/topic?id=1' />",
      "    <updated>2026-06-09T20:06:15+09:00</updated>",
      "  </entry>",
      "</feed>"
    ].join("\n");

    const fetcher = createGeekNewsFetcher(async () =>
      new Response(atomXml, {
        status: 200,
        headers: {
          "Content-Type": "application/atom+xml"
        }
      })
    );

    const items = await fetcher.fetchCandidates();

    expect(items).toHaveLength(1);
    expect(items[0]?.source).toBe("geek_news");
    expect(items[0]?.title).toBe("Agent engineering update");
    expect(items[0]?.url).toBe("https://news.hada.io/topic?id=1");
  });

  test("Anthropic fetcher falls back to nested HTML links when RSS is unavailable", async () => {
    const html = [
      "<html><body>",
      '  <a href="/news/claude-opus-4-8" class="card">',
      '    <h2>Introducing Claude Opus 4.8</h2>',
      "    <p>Latest release</p>",
      "  </a>",
      '  <a href="/news/services-track-partner-hub" class="card">',
      '    <span><strong>Services Track Partner Hub</strong></span>',
      "  </a>",
      "</body></html>"
    ].join("\n");

    let calls = 0;
    const fetcher = createAnthropicBlogFetcher(async () => {
      calls += 1;

      if (calls === 1) {
        return new Response("not found", { status: 404 });
      }

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html"
        }
      });
    });

    const items = await fetcher.fetchCandidates();

    expect(items).toHaveLength(2);
    expect(items[0]?.url).toBe("https://www.anthropic.com/news/claude-opus-4-8");
    expect(items[0]?.title).toBe("Introducing Claude Opus 4.8");
    expect(items[1]?.title).toBe("Services Track Partner Hub");
  });
});
