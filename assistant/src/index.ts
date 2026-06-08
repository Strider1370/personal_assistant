import { buildApp } from "./server/app.js";
import { createAssistantDatabase } from "./db/sqlite.js";
import { loadConfig } from "./shared/config.js";
import { logger } from "./shared/logger.js";

const config = loadConfig();
const database = createAssistantDatabase(config.assistantDbPath);
const app = buildApp(config);

try {
  await app.listen({
    port: config.assistantPort,
    host: "0.0.0.0"
  });

  logger.info("Assistant server started.", {
    port: config.assistantPort
  });
} catch (error) {
  database.close();
  logger.error("Assistant server failed to start.", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    database.close();
    await app.close();
    process.exit(0);
  });
}
