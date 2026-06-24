import { postJson, type AssistantBridgeConfig } from "../http-client.js";

export async function structureNote(config: AssistantBridgeConfig, rawInput: string) {
  return postJson(config, "/notes/structure", {
    rawInput,
    save: false
  });
}
