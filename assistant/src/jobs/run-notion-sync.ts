import { createAssistantDatabase } from "../db/sqlite.js";
import { createNotionSyncClient } from "../notion/notion-client.js";
import { syncApprovedNotionPages } from "../notion/notion-sync.js";
import { loadConfig } from "../shared/config.js";

const config = loadConfig();
const database = createAssistantDatabase(config.assistantDbPath);
const notionClient = createNotionSyncClient(config);

try {
  database.recordJobRun("notion-sync", "started");
  const result = await syncApprovedNotionPages({
    notionClient,
    database,
    vaultPath: config.obsidianVaultPath
  });

  database.recordJobRun("notion-sync", "succeeded", {
    saved: result.saved.length,
    skipped: result.skipped.length,
    failed: result.failed.length
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  database.recordJobRun("notion-sync", "failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
} finally {
  database.close();
}
