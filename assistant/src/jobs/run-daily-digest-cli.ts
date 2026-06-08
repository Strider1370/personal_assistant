import { createAssistantDatabase } from "../db/sqlite.js";
import { createHeuristicDigestRanker, createLlmDigestRanker } from "../digest/ranker.js";
import { createAnthropicBlogFetcher } from "../ingest/anthropic-blog-fetcher.js";
import { createGeekNewsFetcher } from "../ingest/geek-news-fetcher.js";
import { createHackerNewsFetcher } from "../ingest/hn-fetcher.js";
import { createOpenAiBlogFetcher } from "../ingest/openai-blog-fetcher.js";
import { runDailyDigest } from "../jobs/run-daily-digest.js";
import { collectMarkdownFiles } from "../notes/note-index.js";
import { loadConfig } from "../shared/config.js";
import { createTelegramMessageSender } from "../telegram/send-message.js";

const config = loadConfig();
const database = createAssistantDatabase(config.assistantDbPath);
const dryRun = process.argv.includes("--dry-run");

try {
  database.recordJobRun("daily-digest", "started", {
    dryRun
  });
  const noteScanPaths = await collectMarkdownFiles(config.obsidianVaultPath);
  const result = await runDailyDigest({
    database,
    fetchers: [
      createGeekNewsFetcher(),
      createOpenAiBlogFetcher(),
      createAnthropicBlogFetcher(),
      createHackerNewsFetcher()
    ],
    ranker: dryRun ? createLlmDigestRanker(config) : createLlmDigestRanker(config),
    vaultPath: config.obsidianVaultPath,
    noteScanPaths,
    dryRun,
    telegramSender: dryRun ? undefined : createTelegramMessageSender(config)
  });

  database.recordJobRun("daily-digest", "succeeded", {
    itemCount: result.items.length,
    dryRun
  });
  console.log(result.message);
} catch (error) {
  database.recordJobRun("daily-digest", "failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
} finally {
  database.close();
}
