/**
 * Gemini via the REST API.
 *
 * Uses `fetch` rather than the SDK deliberately: it keeps the dependency
 * footprint at zero, and there is no package that could accidentally be
 * resolved into the client bundle.
 */

import "@tanstack/react-start/server-only";

import { AiError, kindForStatus } from "./errors";
import { GroundedAnswerSchema } from "./outputSchema";
import { SYSTEM_PROMPT, buildContextText, buildUserPrompt } from "./prompt";
import type { AiChatProvider, GroundedChatInput, GroundedChatOutput } from "./provider";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini blocks a response by returning a finishReason instead of content. */
const SAFETY_FINISH_REASONS = new Set(["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export function createGeminiProvider(apiKey: string, model: string): AiChatProvider {
  return {
    name: "gemini",

    async generateGroundedAnswer(input: GroundedChatInput): Promise<GroundedChatOutput> {
      const contextText = buildContextText(input);
      const userPrompt = buildUserPrompt(input, contextText);

      // AbortSignal.timeout is available on Workers and Node 18+; the manual
      // controller keeps behaviour identical if a runtime lacks it.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.limits.timeoutMs);

      let response: Response;
      try {
        response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Header rather than query string: keys in URLs end up in logs.
            "x-goog-api-key": apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: input.limits.maxOutputTokens,
              responseMimeType: "application/json",
            },
          }),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new AiError("timeout", "Gemini did not respond in time", "gemini");
        }
        throw new AiError("server_error", "Gemini request failed", "gemini");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new AiError(
          kindForStatus(response.status),
          `Gemini returned HTTP ${response.status}`,
          "gemini",
        );
      }

      const payload = (await response.json()) as GeminiResponse;

      if (payload.promptFeedback?.blockReason) {
        throw new AiError("safety_refusal", "Gemini blocked the prompt", "gemini");
      }

      const candidate = payload.candidates?.[0];
      if (candidate?.finishReason && SAFETY_FINISH_REASONS.has(candidate.finishReason)) {
        throw new AiError("safety_refusal", "Gemini blocked the response", "gemini");
      }

      const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) {
        throw new AiError("invalid_output", "Gemini returned no content", "gemini");
      }

      const parsed = GroundedAnswerSchema.safeParse(safeJsonParse(text));
      if (!parsed.success) {
        throw new AiError("invalid_output", "Gemini output did not match the schema", "gemini");
      }

      return { raw: parsed.data, contextText };
    },
  };
}

/**
 * Models sometimes wrap JSON in a markdown fence despite responseMimeType.
 * Tolerating that is cheaper than losing the whole answer to a stray fence.
 */
export function safeJsonParse(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "")
    : trimmed;
  try {
    return JSON.parse(unfenced);
  } catch {
    return null;
  }
}
