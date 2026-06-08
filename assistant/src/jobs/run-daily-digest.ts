import type { AssistantDatabase } from "../db/sqlite.js";
import { filterDigestCandidates } from "../digest/candidate-filter.js";
import { formatDigest } from "../digest/formatter.js";
import { findRelatedNotesForDigestItem } from "../digest/related-notes.js";
import type { DigestRanker } from "../digest/ranker.js";
import type { RankedDigestItem } from "../digest/types.js";
import type { DigestCandidateFetcher } from "../ingest/types.js";
import { scanNotesIntoIndex } from "../notes/note-index.js";
import type { TelegramMessageSender } from "../telegram/send-message.js";

type RunDailyDigestInput = {
  database: AssistantDatabase;
  fetchers: DigestCandidateFetcher[];
  ranker: DigestRanker;
  vaultPath: string;
  noteScanPaths: string[];
  dryRun?: boolean;
  telegramSender?: TelegramMessageSender;
};

type RunDailyDigestResult = {
  items: RankedDigestItem[];
  message: string;
  delivery: {
    skipped: boolean;
  };
};

export async function runDailyDigest(input: RunDailyDigestInput): Promise<RunDailyDigestResult> {
  await scanNotesIntoIndex(input.noteScanPaths, input.database);

  const fetchedGroups = await Promise.allSettled(input.fetchers.map((fetcher) => fetcher.fetchCandidates()));
  const fetched = fetchedGroups
    .filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<DigestCandidateFetcher["fetchCandidates"]>>> =>
        result.status === "fulfilled"
    )
    .flatMap((result) => result.value);
  const unseen = fetched.filter((item) => !input.database.hasSentDigest(item.source, item.sourceId));
  const filtered = filterDigestCandidates(unseen, {
    minHnPoints: 50,
    minHnComments: 10
  });
  const ranked = (await input.ranker.rankCandidates(filtered)).slice(0, 5);
  const items = await attachRelatedNotes(ranked, input.database);
  const message = formatDigest(items);

  if (input.dryRun === false && input.telegramSender) {
    await input.telegramSender.sendMessage(message);

    for (const item of items) {
      input.database.markDigestSent({
        source: item.source,
        sourceId: item.sourceId
      });
    }
  }

  return {
    items,
    message,
    delivery: {
      skipped: !(input.dryRun === false && input.telegramSender)
    }
  };
}

async function attachRelatedNotes(
  items: RankedDigestItem[],
  database: AssistantDatabase
): Promise<RankedDigestItem[]> {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      relatedNotes: await findRelatedNotesForDigestItem(item, database)
    }))
  );
}
