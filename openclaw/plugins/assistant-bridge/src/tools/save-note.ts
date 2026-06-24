import { postJson, type AssistantBridgeConfig } from "../http-client.js";

export async function saveNote(config: AssistantBridgeConfig, rawInput: string) {
  return postJson(config, "/notes/structure", {
    rawInput,
    save: true
  });
}
