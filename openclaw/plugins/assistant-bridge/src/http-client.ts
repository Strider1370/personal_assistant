export type AssistantBridgeConfig = {
  baseUrl: string;
  apiKey?: string;
};

function buildHeaders(config: AssistantBridgeConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(config.apiKey ? { "X-Assistant-Key": config.apiKey } : {})
  };
}

export async function postJson<TResponse>(
  config: AssistantBridgeConfig,
  path: string,
  body: unknown
): Promise<TResponse> {
  const response = await fetch(new URL(path, config.baseUrl), {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`assistant bridge request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export async function getJson<TResponse>(config: AssistantBridgeConfig, path: string): Promise<TResponse> {
  const response = await fetch(new URL(path, config.baseUrl), {
    method: "GET",
    headers: config.apiKey ? { "X-Assistant-Key": config.apiKey } : undefined
  });

  if (!response.ok) {
    throw new Error(`assistant bridge request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
