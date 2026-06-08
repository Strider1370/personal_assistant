import type { DigestItemCandidate } from "./types.js";

const includeKeywords = [
  "ai",
  "llm",
  "agent",
  "agents",
  "model",
  "models",
  "mcp",
  "plugin",
  "plugins",
  "sdk",
  "api",
  "openai",
  "anthropic",
  "chatgpt",
  "claude",
  "cursor",
  "v0",
  "vercel",
  "copilot",
  "prompt",
  "prompts",
  "qwen",
  "deepseek",
  "gemini",
  "rag",
  "inference",
  "fine-tuning",
  "coding agent",
  "developer tool",
  "개발자",
  "개발툴",
  "개발 도구",
  "에이전트",
  "모델",
  "프롬프트",
  "코딩 도구",
  "생성형 ai",
  "인공지능",
  "llm이",
  "오픈소스 ai"
];

const excludeKeywords = [
  "prison",
  "felony",
  "social media",
  "dopamine",
  "record cutter",
  "data breaches",
  "암호화폐",
  "사이퍼펑크",
  "친구",
  "인생",
  "중독",
  "수감",
  "전과",
  "정치",
  "스포츠"
];

export function deriveDigestTags(text: string): string[] {
  const lowered = text.toLowerCase();
  const tags = new Set<string>();

  if (hasAny(lowered, ["ai", "llm", "model", "openai", "anthropic", "chatgpt", "claude", "gemini", "qwen", "deepseek", "인공지능", "모델"])) {
    tags.add("ai");
  }
  if (hasAny(lowered, ["agent", "agents", "mcp", "에이전트"])) {
    tags.add("agent");
  }
  if (hasAny(lowered, ["plugin", "plugins", "sdk", "api", "cursor", "copilot", "vercel", "개발툴", "개발 도구", "코딩 도구"])) {
    tags.add("tooling");
  }
  if (hasAny(lowered, ["prompt", "prompts", "프롬프트"])) {
    tags.add("prompting");
  }

  return [...tags];
}

export function isRelevantDigestCandidate(candidate: DigestItemCandidate): boolean {
  const text = `${candidate.title} ${candidate.url}`.toLowerCase();

  if (excludeKeywords.some((keyword) => text.includes(keyword))) {
    return false;
  }

  if (candidate.tags.some((tag) => ["ai", "agent", "tooling", "prompting", "official"].includes(tag))) {
    return true;
  }

  return includeKeywords.some((keyword) => text.includes(keyword));
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
