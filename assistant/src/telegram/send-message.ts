import type { AppConfig } from "../shared/config.js";

export type TelegramMessageSender = {
  sendMessage(text: string): Promise<void>;
};

type FetchLike = typeof fetch;

export function createTelegramMessageSender(
  config: AppConfig,
  fetchImpl: FetchLike = fetch
): TelegramMessageSender {
  return {
    async sendMessage(text: string) {
      const response = await fetchImpl(
        `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text,
            disable_web_page_preview: true
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Telegram send failed with status ${response.status}.`);
      }
    }
  };
}
