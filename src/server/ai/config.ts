/**
 * Server-only AI configuration.
 *
 * The `server-only` marker import makes the bundler fail loudly if this module
 * is ever pulled into the client graph — the guarantee that an API key cannot
 * reach the browser is enforced by the build, not by convention.
 *
 * Every limit here exists to protect a free-tier quota. They are read from the
 * environment so they can be tightened in production without a code change.
 */

import "@tanstack/react-start/server-only";

export type ProviderName = "gemini" | "groq";

export interface AiLimits {
  maxQuestionChars: number;
  maxContextChars: number;
  maxHistoryMessages: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface AiConfig {
  enabled: boolean;
  provider: ProviderName;
  fallbackProvider: ProviderName | null;
  gemini: { apiKey: string; model: string };
  groq: { apiKey: string; model: string };
  limits: AiLimits;
}

/**
 * Reads an environment variable across the runtimes this app targets.
 *
 * Node and Vite dev populate `process.env`. On Cloudflare Workers, Nitro's
 * preset mirrors the worker bindings (wrangler secrets and .dev.vars) onto
 * `process.env` too, but the global fallback keeps this working if a future
 * preset stops doing that.
 */
function readEnv(name: string): string {
  const fromProcess = typeof process !== "undefined" && process.env ? process.env[name] : undefined;
  if (typeof fromProcess === "string") return fromProcess.trim();

  const globalEnv = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const fromGlobal = globalEnv?.[name];
  return typeof fromGlobal === "string" ? fromGlobal.trim() : "";
}

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  // Clamp rather than trust: a typo'd AI_MAX_OUTPUT_TOKENS=60000 would empty a
  // free tier in a handful of requests.
  return Math.min(Math.max(parsed, min), max);
}

function readProvider(name: string, fallback: ProviderName | null): ProviderName | null {
  const raw = readEnv(name).toLowerCase();
  if (raw === "gemini" || raw === "groq") return raw;
  if (raw === "none" || raw === "") return fallback;
  return fallback;
}

export const DEFAULT_LIMITS: AiLimits = {
  maxQuestionChars: 1200,
  maxContextChars: 12_000,
  maxHistoryMessages: 6,
  maxOutputTokens: 600,
  timeoutMs: 15_000,
};

export function readAiConfig(): AiConfig {
  // Gemini leads; Groq covers the case where Gemini is rate-limited, timing out
  // or temporarily unavailable. Neither is ever required: the deterministic
  // answer is the final fallback.
  const provider = readProvider("AI_PROVIDER", "gemini") ?? "gemini";
  const fallbackProvider = readProvider("AI_FALLBACK_PROVIDER", "groq");

  return {
    // Enabled unless explicitly switched off. Without a key the layer is still
    // unusable, so this cannot turn on provider calls on its own.
    enabled: readEnv("AI_CHAT_ENABLED").toLowerCase() !== "false",
    provider,
    // A provider must never fall back to itself.
    fallbackProvider: fallbackProvider === provider ? null : fallbackProvider,
    gemini: {
      apiKey: readEnv("GEMINI_API_KEY"),
      model: readEnv("GEMINI_MODEL") || "gemini-2.0-flash",
    },
    groq: {
      apiKey: readEnv("GROQ_API_KEY"),
      model: readEnv("GROQ_MODEL") || "llama-3.3-70b-versatile",
    },
    limits: {
      maxQuestionChars: readInt("AI_MAX_QUESTION_CHARS", DEFAULT_LIMITS.maxQuestionChars, 40, 4000),
      maxContextChars: readInt("AI_MAX_CONTEXT_CHARS", DEFAULT_LIMITS.maxContextChars, 500, 40_000),
      maxHistoryMessages: readInt(
        "AI_MAX_HISTORY_MESSAGES",
        DEFAULT_LIMITS.maxHistoryMessages,
        0,
        20,
      ),
      maxOutputTokens: readInt("AI_MAX_OUTPUT_TOKENS", DEFAULT_LIMITS.maxOutputTokens, 100, 2000),
      timeoutMs: readInt("AI_TIMEOUT_MS", DEFAULT_LIMITS.timeoutMs, 1000, 60_000),
    },
  };
}

/** True when the named provider has a key configured. */
export function hasKey(config: AiConfig, provider: ProviderName): boolean {
  return config[provider].apiKey.length > 0;
}
