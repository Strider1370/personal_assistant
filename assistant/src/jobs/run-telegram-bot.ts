import { createNoteStructureModelClient } from "../llm/model-client.js";
import { loadConfig } from "../shared/config.js";
import { createTelegramBot } from "../telegram/bot.js";
import { createTelegramMessageSender } from "../telegram/send-message.js";

const config = loadConfig();
const sender = createTelegramMessageSender(config);
const modelClient = createNoteStructureModelClient(config);
const bot = createTelegramBot(sender, config, modelClient);

console.log("telegram bot polling started");
await bot.pollForever();
