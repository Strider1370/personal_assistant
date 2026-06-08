import type { AppConfig } from "../shared/config.js";
import { parseStructuredNoteDraftFromModel } from "./output-parsers.js";

export type NoteStructureResult = {
  draft: ReturnType<typeof parseStructuredNoteDraftFromModel>;
};

export type NoteStructureModelClient = {
  structureRawNote(rawInput: string): Promise<NoteStructureResult>;
};

type FetchLike = typeof fetch;

export function createNoteStructureModelClient(
  config: AppConfig,
  fetchImpl: FetchLike = fetch
): NoteStructureModelClient {
  return {
    async structureRawNote(rawInput) {
      const response = await fetchImpl(`${config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.llmApiKey}`
        },
        body: JSON.stringify({
          model: config.llmModel,
          enable_thinking: config.llmEnableThinking,
          temperature: 0.2,
          response_format: {
            type: "json_object"
          },
          messages: [
            {
              role: "system",
              content:
                "Convert raw notes into a valid StructuredNoteDraft JSON object. Return JSON only."
            },
            {
              role: "user",
              content: [
                "Normalize this raw note into JSON with fields:",
                "type, title, summary, bullets, reflection, tags, relatedNoteHints, source, createdAt, rawInput, notionPageId.",
                "Rules:",
                '- source must be "llm".',
                "- createdAt must be a valid ISO timestamp.",
                "- bullets should contain 2-5 concise strings when possible.",
                "",
                rawInput
              ].join("\n")
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`LLM request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("LLM response did not include message content.");
      }

      return {
        draft: parseStructuredNoteDraftFromModel(content)
      };
    }
  };
}
