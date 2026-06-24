import { getJson, type AssistantBridgeConfig } from "../http-client.js";

export async function checkHealth(config: AssistantBridgeConfig) {
  return getJson(config, "/health");
}
