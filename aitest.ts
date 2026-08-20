/* Temporary live provider check. Deleted after use. */
import { loadCorpus } from "@/domain/dataAdapters";
import { evaluateRules } from "@/domain/evaluateRules";
import { scenarios } from "@/domain/scenarios";
import { askStayValidPipeline } from "@/server/ai/askPipeline";
import { readAiConfig } from "@/server/ai/config";

const { corpus } = loadCorpus();
const scenario = scenarios[1]!;
const profile = scenario.profile;
const asOf = "2026-08-20";
const evaluation = evaluateRules(profile, corpus, asOf);
const base = readAiConfig();

for (const provider of ["groq"] as const) {
  const config = { ...base, enabled: true, provider, fallbackProvider: null };
  const { createGroqProvider } = await import("@/server/ai/groqProvider");
  const inner = createGroqProvider(base.groq.apiKey, base.groq.model);
  const wrapped = {
    name: "groq" as const,
    async generateGroundedAnswer(input: Parameters<typeof inner.generateGroundedAnswer>[0]) {
      try {
        return await inner.generateGroundedAnswer(input);
      } catch (e) {
        const { SYSTEM_PROMPT, buildContextText, buildUserPrompt } = await import("@/server/ai/prompt");
        const up = buildUserPrompt(input, buildContextText(input));
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${base.groq.apiKey}` },
          body: JSON.stringify({ model: base.groq.model, temperature: 0.2, max_tokens: base.limits.maxOutputTokens, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: up }] }),
        });
        const j = (await r.json()) as any;
        console.log("safety", input.safetyCategory, "rules", input.rules.length, "status", r.status, JSON.stringify(j).slice(0, 600));
        console.log("ERR", (e as { kind?: string }).kind, (e as Error).message);
        throw e;
      }
    },
  };
  const result = await askStayValidPipeline({
    providers: { groq: wrapped },
    question: "What does duration of status mean for my program end date?",
    profile,
    corpus,
    evaluation,
    recentMessages: [],
    config,
  });
  console.log(
    JSON.stringify({
      provider,
      origin: result.answer.origin,
      fallbackReason: result.fallbackReason,
      schemaValidated: result.answer.origin === provider,
      sourceIds: result.answer.sourceIds.length,
      answerChars: result.answer.answer.length,
    }),
  );
}
