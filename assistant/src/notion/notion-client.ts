import type { AppConfig } from "../shared/config.js";

export type NotionPageSummary = {
  id: string;
  lastEditedTime: string;
  properties: {
    title: string;
    type: string;
    summary: string;
    bullets: string[];
    reflection?: string;
    tags: string[];
    source: string;
    approvalStatus: string;
    syncedToObsidian: boolean;
  };
};

export type NotionSyncClient = {
  listCandidatePages(): Promise<NotionPageSummary[]>;
};

type FetchLike = typeof fetch;

export function createNotionSyncClient(
  config: AppConfig,
  fetchImpl: FetchLike = fetch
): NotionSyncClient {
  return {
    async listCandidatePages() {
      const payload = await queryNotionCollection(config, fetchImpl);

      return (payload.results ?? []).map((page) => mapNotionApiPage(page));
    }
  };
}

async function queryNotionCollection(
  config: AppConfig,
  fetchImpl: FetchLike
): Promise<{ results?: unknown[] }> {
  const collectionId = await resolveNotionCollectionId(config, fetchImpl);
  const headers = {
    Authorization: `Bearer ${config.notionToken}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };
  const body = JSON.stringify({
    filter: {
      and: [
        {
          property: "Approval Status",
          status: {
            equals: "Approved"
          }
        },
        {
          property: "Synced To Obsidian",
          checkbox: {
            equals: false
          }
        }
      ]
    }
  });
  const endpoints = [
    `https://api.notion.com/v1/data_sources/${collectionId}/query`,
    `https://api.notion.com/v1/databases/${collectionId}/query`
  ];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body
    });

    if (response.ok) {
      return (await response.json()) as { results?: unknown[] };
    }

    const responseText = await response.text();
    lastError = new Error(
      `Notion query failed with status ${response.status}: ${sanitizeErrorMessage(responseText)}`
    );
  }

  throw lastError ?? new Error("Notion query failed.");
}

async function resolveNotionCollectionId(
  config: AppConfig,
  fetchImpl: FetchLike
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${config.notionToken}`,
    "Notion-Version": "2022-06-28"
  };
  const pageResponse = await fetchImpl(`https://api.notion.com/v1/pages/${config.notionDatabaseId}`, {
    headers
  });

  if (!pageResponse.ok) {
    return config.notionDatabaseId;
  }

  const childrenResponse = await fetchImpl(
    `https://api.notion.com/v1/blocks/${config.notionDatabaseId}/children?page_size=100`,
    { headers }
  );

  if (!childrenResponse.ok) {
    return config.notionDatabaseId;
  }

  const childrenPayload = (await childrenResponse.json()) as {
    results?: Array<{ id: string; type: string }>;
  };
  const childDatabase = childrenPayload.results?.find((block) => block.type === "child_database");

  return childDatabase?.id ?? config.notionDatabaseId;
}

function sanitizeErrorMessage(value: string): string {
  return value.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]").slice(0, 300);
}

function mapNotionApiPage(page: unknown): NotionPageSummary {
  const typedPage = page as {
    id: string;
    last_edited_time: string;
    properties: Record<string, any>;
  };

  return {
    id: typedPage.id,
    lastEditedTime: typedPage.last_edited_time,
    properties: {
      title: typedPage.properties?.Title?.title?.[0]?.plain_text ?? "",
      type: typedPage.properties?.Type?.select?.name ?? "",
      summary: typedPage.properties?.Summary?.rich_text?.[0]?.plain_text ?? "",
      bullets: readBulletsProperty(typedPage.properties?.Bullets),
      reflection: typedPage.properties?.Reflection?.rich_text?.[0]?.plain_text ?? undefined,
      tags: (typedPage.properties?.Tags?.multi_select ?? []).map((entry: any) => entry.name),
      source: typedPage.properties?.Source?.select?.name ?? "",
      approvalStatus: typedPage.properties?.["Approval Status"]?.status?.name ?? "",
      syncedToObsidian: Boolean(typedPage.properties?.["Synced To Obsidian"]?.checkbox)
    }
  };
}

function readBulletsProperty(property: any): string[] {
  if (!property) {
    return [];
  }

  if (property.type === "multi_select") {
    return (property.multi_select ?? []).map((entry: any) => entry.name).filter(Boolean);
  }

  if (property.type === "rich_text") {
    return (property.rich_text ?? [])
      .map((entry: any) => entry.plain_text?.trim())
      .filter((value: string | undefined): value is string => Boolean(value));
  }

  return [];
}
