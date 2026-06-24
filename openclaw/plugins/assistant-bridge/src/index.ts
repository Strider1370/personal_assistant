import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { checkHealth } from "./tools/health.js";
import { saveNote } from "./tools/save-note.js";
import { structureNote } from "./tools/structure-note.js";

type RawInputParams = {
  rawInput: string;
};

const rawInputParams = Type.Object({
  rawInput: Type.String({ minLength: 1, description: "The raw note text to structure or save." })
});

function toTextResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ],
    details: value
  };
}

function parseRawInputParams(params: unknown): RawInputParams {
  if (
    !params ||
    typeof params !== "object" ||
    !("rawInput" in params) ||
    typeof params.rawInput !== "string" ||
    params.rawInput.trim().length === 0
  ) {
    throw new Error("rawInput must be a non-empty string.");
  }

  return {
    rawInput: params.rawInput
  };
}

export default definePluginEntry({
  id: "assistant-bridge",
  name: "Assistant Bridge",
  description: "Bridges OpenClaw tools to the existing assistant backend HTTP API.",
  register(api) {
    const config = {
      baseUrl: process.env.ASSISTANT_BASE_URL ?? "http://127.0.0.1:3010",
      apiKey: process.env.ASSISTANT_API_KEY
    };

    api.registerTool({
      name: "assistant.health",
      label: "Assistant Health",
      description: "Check that the assistant backend is reachable.",
      parameters: Type.Object({}),
      async execute() {
        return toTextResult(await checkHealth(config));
      }
    });

    api.registerTool({
      name: "assistant.save_note",
      label: "Save Note",
      description: "Structure and save a note through the assistant backend.",
      parameters: rawInputParams,
      async execute(_id, params) {
        const parsed = parseRawInputParams(params);
        return toTextResult(await saveNote(config, parsed.rawInput));
      }
    });

    api.registerTool({
      name: "assistant.structure_note",
      label: "Structure Note",
      description: "Structure a note without saving it.",
      parameters: rawInputParams,
      async execute(_id, params) {
        const parsed = parseRawInputParams(params);
        return toTextResult(await structureNote(config, parsed.rawInput));
      }
    });
  }
});
