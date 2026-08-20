/**
 * Groq via its OpenAI-compatible chat-completions endpoint.
 *
 * Only ever called when Gemini fails with a temporary, fallback-eligible error
 * (see `isFallbackEligible`). It is never called in parallel, and never as a
 * second opinion on a safety refusal.
 */

import "@tanstack/react-start/server-only";

import { AiError, kindForStatus } from "./errors";
import { safeJsonParse } from "./geminiProvider";
import { GroundedAnswerSchema } from "./outputSchema";
import { SYSTEM_PROMPT, buildContextText, buildUserPrompt } from "./prompt";
import type { AiChatProvider, GroundedChatInput, GroundedChatOutput } from "./provider";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface GroqResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
}

export function createGroqProvider(apiKey: string, model: string): AiChatProvider {
  return {
    name: "groq",

    async generateGroundedAnswer(input: GroundedChatInput): Promise<GroundedChatOutput> {
      const contextText = buildContextText(input);
      const userPrompt = buildUserPrompt(input, contextText);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.limits.timeoutMs);

      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: input.limits.maxOutputTokens,
            // Same reason as Gemini: reasoning tokens eat the output budget.
            reasoning_effort: "low",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
          }),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new AiError("timeout", "Groq did not respond in time", "groq");
        }
        throw new AiError("server_error", "Groq request failed", "groq");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new AiError(
          kindForStatus(response.status),
          `Groq returned HTTP ${response.status}`,
          "groq",
        );
      }

      const payload = (await response.json()) as GroqResponse;
      const choice = payload.choices?.[0];

      if (choice?.finish_reason === "content_filter") {
        throw new AiError("safety_refusal", "Groq filtered the response", "groq");
      }

      const text = choice?.message?.content ?? "";
      if (!text.trim()) {
        throw new AiError("invalid_output", "Groq returned no content", "groq");
      }

      const parsed = GroundedAnswerSchema.safeParse(safeJsonParse(text));
      if (!parsed.success) {
        throw new AiError("invalid_output", "Groq output did not match the schema", "groq");
      }

      return { raw: parsed.data, contextText };
    },
  };
}
