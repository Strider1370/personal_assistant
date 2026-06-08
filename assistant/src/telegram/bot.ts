import { renderStructuredNote } from "../notes/note-renderer.js";
import { saveNoteMarkdown } from "../notes/note-writer.js";
import type { AppConfig } from "../shared/config.js";
import type { NoteStructureModelClient } from "../llm/model-client.js";
import type { TelegramMessageSender } from "./send-message.js";

type FetchLike = typeof fetch;

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat?: {
      id: number;
      type: string;
    };
  };
};

export function createTelegramBot(
  sender: TelegramMessageSender,
  config: AppConfig,
  modelClient: NoteStructureModelClient,
  fetchImpl: FetchLike = fetch
) {
  return {
    async sendDigest(message: string) {
      await sender.sendMessage(message);
    },

    async pollForever() {
      let offset = await getInitialOffset(config, fetchImpl);

      while (true) {
        try {
          const updates = await getUpdates(config, fetchImpl, offset);

          for (const update of updates) {
            offset = update.update_id + 1;
            await handleUpdate(update, sender, config, modelClient, fetchImpl);
          }
        } catch (error) {
          await sleep(3000);
          console.error("telegram polling error", error instanceof Error ? error.message : String(error));
        }
      }
    }
  };
}

async function handleUpdate(
  update: TelegramUpdate,
  sender: TelegramMessageSender,
  config: AppConfig,
  modelClient: NoteStructureModelClient,
  fetchImpl: FetchLike
) {
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;

  if (!text || !chatId || String(chatId) !== config.telegramChatId) {
    return;
  }

  if (text.startsWith("/save ")) {
    const rawInput = text.slice("/save ".length).trim();

    if (!rawInput) {
      await sendMessageToChat(config, fetchImpl, "저장할 메모 내용을 `/save 내용` 형식으로 보내주세요.");
      return;
    }

    const result = await modelClient.structureRawNote(rawInput);
    const markdown = renderStructuredNote(result.draft);
    const saved = await saveNoteMarkdown({
      vaultPath: config.obsidianVaultPath,
      title: result.draft.title,
      createdAt: result.draft.createdAt,
      markdown
    });

    await sendMessageToChat(
      config,
      fetchImpl,
      [
        "메모 저장 완료.",
        `제목: ${result.draft.title}`,
        `파일: ${saved.filename}`,
        `요약: ${result.draft.summary}`
      ].join("\n")
    );
    return;
  }

  if (text === "/health") {
    await sendMessageToChat(config, fetchImpl, "assistant bot 정상 동작 중입니다.");
    return;
  }

  const reply = await createChatReply(text, config, fetchImpl);
  await sendMessageToChat(config, fetchImpl, reply);
}

async function createChatReply(
  userText: string,
  config: AppConfig,
  fetchImpl: FetchLike
): Promise<string> {
  const response = await fetchImpl(`${config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llmApiKey}`
    },
    body: JSON.stringify({
      model: config.llmModel,
      enable_thinking: config.llmEnableThinking,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "당신은 한국어로만 답하는 개인 AI 비서다. 짧고 실용적으로 답한다. 필요하면 bullet 없이 2~5문장으로 답하라."
        },
        {
          role: "user",
          content: userText
        }
      ]
    })
  });

  if (!response.ok) {
    return `응답 생성에 실패했습니다. 상태 코드: ${response.status}`;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();

  return content || "응답을 생성하지 못했습니다.";
}

async function getInitialOffset(config: AppConfig, fetchImpl: FetchLike): Promise<number> {
  const updates = await getUpdates(config, fetchImpl);
  const last = updates.at(-1);
  return last ? last.update_id + 1 : 0;
}

async function getUpdates(
  config: AppConfig,
  fetchImpl: FetchLike,
  offset?: number
): Promise<TelegramUpdate[]> {
  const url = new URL(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates`);
  url.searchParams.set("timeout", "25");
  if (typeof offset === "number") {
    url.searchParams.set("offset", String(offset));
  }

  const response = await fetchImpl(url, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Telegram getUpdates failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    result?: TelegramUpdate[];
  };

  return payload.result ?? [];
}

async function sendMessageToChat(
  config: AppConfig,
  fetchImpl: FetchLike,
  text: string
) {
  const response = await fetchImpl(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with status ${response.status}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
