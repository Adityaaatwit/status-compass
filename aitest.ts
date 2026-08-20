/* Temporary live provider check. Deleted after use. */
import { loadCorpus } from "@/domain/dataAdapters";
import { evaluateRules } from "@/domain/evaluateRules";
import { SCENARIOS } from "@/domain/scenarios";
import { askStayValidPipeline } from "@/server/ai/askPipeline";
import { readAiConfig } from "@/server/ai/config";

const { corpus } = loadCorpus();
const scenario = SCENARIOS[0]!;
const profile = scenario.profile;
const asOf = "2026-08-20";
const evaluation = evaluateRules(profile, corpus, asOf);
const base = readAiConfig();

for (const provider of ["gemini", "groq"] as const) {
  const config = { ...base, enabled: true, provider, fallbackProvider: null };
  const result = await askStayValidPipeline({
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
