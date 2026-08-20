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
