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

type DigestSelectionOptions = {
  limit: number;
  maxPerSourceBeforeDiversifying: number;
  lookaheadWindow: number;
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
  const ranked = selectTopDigestItems(await input.ranker.rankCandidates(filtered), {
    limit: 5,
    maxPerSourceBeforeDiversifying: 3,
    lookaheadWindow: 3
  });
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

export function selectTopDigestItems(
  ranked: RankedDigestItem[],
  options: DigestSelectionOptions
): RankedDigestItem[] {
  const selected: RankedDigestItem[] = [];
  const deferred: RankedDigestItem[] = [];
  const perSourceCount = new Map<RankedDigestItem["source"], number>();

  for (let index = 0; index < ranked.length && selected.length < options.limit; index += 1) {
    if (selected.length === options.limit - 1 && deferred.length > 0) {
      const deferredCandidate = deferred.shift();

      if (deferredCandidate) {
        selected.push(deferredCandidate);
        perSourceCount.set(
          deferredCandidate.source,
          (perSourceCount.get(deferredCandidate.source) ?? 0) + 1
        );
      }

      break;
    }

    const candidate = ranked[index];
    const count = perSourceCount.get(candidate.source) ?? 0;

    if (
      selected.length < options.limit - 1 &&
      count >= options.maxPerSourceBeforeDiversifying &&
      hasAlternativeSourceNearby(ranked, index + 1, candidate.source, options.lookaheadWindow)
    ) {
      deferred.push(candidate);
      continue;
    }

    selected.push(candidate);
    perSourceCount.set(candidate.source, count + 1);
  }

  for (const candidate of deferred) {
    if (selected.length >= options.limit) {
      break;
    }

    selected.push(candidate);
  }

  return selected.slice(0, options.limit);
}

function hasAlternativeSourceNearby(
  ranked: RankedDigestItem[],
  startIndex: number,
  source: RankedDigestItem["source"],
  lookaheadWindow: number
): boolean {
  const endIndex = Math.min(ranked.length, startIndex + lookaheadWindow);

  for (let index = startIndex; index < endIndex; index += 1) {
    if (ranked[index]?.source !== source) {
      return true;
    }
  }

  return false;
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
