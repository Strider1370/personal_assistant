import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

export type AppConfig = {
  obsidianVaultPath: string;
  assistantPort: number;
  assistantDbPath: string;
  llmProvider: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmEnableThinking: boolean;
  notionToken: string;
  notionDatabaseId: string;
  telegramBotToken: string;
  telegramChatId: string;
  digestTimezone: string;
};

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envFileCandidates = [
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(moduleDir, "../../../.env"),
  path.resolve(moduleDir, "../../../../.env")
];

const envFilePath = envFileCandidates.find((candidate) => existsSync(candidate)) ?? envFileCandidates[0];

const envSchema = z.object({
  OBSIDIAN_VAULT_PATH: z.string().trim().min(1),
  ASSISTANT_PORT: z.coerce.number().int().positive().default(3010),
  ASSISTANT_DB_PATH: z.string().trim().min(1).default("./assistant/data/assistant.db"),
  LLM_PROVIDER: z.string().trim().min(1).default("alibaba"),
  LLM_BASE_URL: z.string().trim().url(),
  LLM_API_KEY: z.string().trim().min(1),
  LLM_MODEL: z.string().trim().min(1).default("deepseek-v4-flash"),
  LLM_ENABLE_THINKING: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "true")
    .default(false),
  NOTION_TOKEN: z.string().trim().min(1),
  NOTION_DATABASE_ID: z.string().trim().min(1),
  TELEGRAM_BOT_TOKEN: z.string().trim().min(1),
  TELEGRAM_CHAT_ID: z.string().trim().min(1),
  DIGEST_TIMEZONE: z.string().trim().min(1).default("UTC")
});

export function loadConfig(): AppConfig {
  dotenv.config({ path: envFilePath });

  const parsed = envSchema.parse({
    OBSIDIAN_VAULT_PATH: process.env.OBSIDIAN_VAULT_PATH,
    ASSISTANT_PORT: process.env.ASSISTANT_PORT ?? 3010,
    ASSISTANT_DB_PATH: process.env.ASSISTANT_DB_PATH ?? "./assistant/data/assistant.db",
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_MODEL: process.env.LLM_MODEL ?? "deepseek-v4-flash",
    LLM_ENABLE_THINKING: process.env.LLM_ENABLE_THINKING ?? "false",
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    DIGEST_TIMEZONE: process.env.DIGEST_TIMEZONE ?? "UTC"
  });

  if (!path.isAbsolute(parsed.OBSIDIAN_VAULT_PATH)) {
    throw new Error("OBSIDIAN_VAULT_PATH must be an absolute path.");
  }

  return {
    obsidianVaultPath: path.resolve(parsed.OBSIDIAN_VAULT_PATH),
    assistantPort: parsed.ASSISTANT_PORT,
    assistantDbPath: path.isAbsolute(parsed.ASSISTANT_DB_PATH)
      ? path.resolve(parsed.ASSISTANT_DB_PATH)
      : path.resolve(path.dirname(envFilePath), parsed.ASSISTANT_DB_PATH),
    llmProvider: parsed.LLM_PROVIDER,
    llmBaseUrl: parsed.LLM_BASE_URL,
    llmApiKey: parsed.LLM_API_KEY,
    llmModel: parsed.LLM_MODEL,
    llmEnableThinking: parsed.LLM_ENABLE_THINKING,
    notionToken: parsed.NOTION_TOKEN,
    notionDatabaseId: parsed.NOTION_DATABASE_ID,
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    telegramChatId: parsed.TELEGRAM_CHAT_ID,
    digestTimezone: parsed.DIGEST_TIMEZONE
  };
}
