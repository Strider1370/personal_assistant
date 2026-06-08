import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createAssistantDatabase } from "../../src/db/sqlite.js";
import { runDailyDigest } from "../../src/jobs/run-daily-digest.js";
import type { DigestCandidateFetcher } from "../../src/ingest/types.js";
import type { DigestRanker } from "../../src/digest/ranker.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assistant-digest-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runDailyDigest", () => {
  test("builds a dry-run digest, skips already-sent items, and adds related notes", async () => {
    const dir = await makeTempDir();
    const db = createAssistantDatabase(path.join(dir, "assistant.db"));
    const vaultPath = path.join(dir, "vault");
    await writeFile(
      path.join(dir, "note.md"),
      [
        "---",
        "type: note",
        "tags:",
        "  - ai",
        "---",
        "",
        "# Indexed note"
      ].join("\n"),
      "utf8"
    );

    db.markDigestSent({
      source: "hacker_news",
      sourceId: "hn-skip"
    });

    const fetcher: DigestCandidateFetcher = {
      async fetchCandidates() {
        return [
          {
            source: "hacker_news",
            sourceId: "hn-skip",
            title: "Already sent",
            url: "https://example.com/skip",
            publishedAt: "2026-06-08T10:00:00Z",
            reactionScore: 150,
            sourceSignals: { hnPoints: 150, hnComments: 70 },
            tags: ["ai"]
          },
          {
            source: "openai_blog",
            sourceId: "oa-1",
            title: "OpenAI official update",
            url: "https://example.com/oa-1",
            publishedAt: "2026-06-08T10:00:00Z",
            reactionScore: 0,
            sourceSignals: { officialSource: true },
            tags: ["ai"]
          },
          {
            source: "anthropic_blog",
            sourceId: "an-1",
            title: "Anthropic official update",
            url: "https://example.com/an-1",
            publishedAt: "2026-06-08T09:00:00Z",
            reactionScore: 0,
            sourceSignals: { officialSource: true },
            tags: ["agent"]
          },
          {
            source: "hacker_news",
            sourceId: "hn-2",
            title: "Strong HN item",
            url: "https://example.com/hn-2",
            publishedAt: "2026-06-08T08:00:00Z",
            reactionScore: 130,
            sourceSignals: { hnPoints: 140, hnComments: 55 },
            tags: ["ai", "tooling"]
          }
        ];
      }
    };

    const ranker: DigestRanker = {
      async rankCandidates(candidates) {
        return candidates.map((candidate) => ({
          ...candidate,
          summary: `${candidate.title} summary`,
          whyItMatters: `${candidate.title} matters`,
          userRelevance: `${candidate.title} is relevant`,
          nextAction: `Read ${candidate.title}`
        }));
      }
    };

    const result = await runDailyDigest({
      database: db,
      fetchers: [fetcher],
      ranker,
      vaultPath,
      noteScanPaths: [path.join(dir, "note.md")],
      dryRun: true
    });

    expect(result.items).toHaveLength(3);
    expect(result.items.some((item) => item.sourceId === "hn-skip")).toBe(false);
    expect(result.items[0]?.relatedNotes?.[0]?.title).toBe("Indexed note");
    expect(result.delivery.skipped).toBe(true);
    db.close();
  });
});
