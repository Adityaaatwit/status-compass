/* Temporary provider error probe. Deleted after use. */
import { loadCorpus } from "@/domain/dataAdapters";
import { evaluateRules } from "@/domain/evaluateRules";
import { scenarios } from "@/domain/scenarios";
import { retrieveVerifiedContext } from "@/domain/chat/retrieveVerifiedContext";
import { createGeminiProvider } from "@/server/ai/geminiProvider";
import { createGroqProvider } from "@/server/ai/groqProvider";
import { readAiConfig } from "@/server/ai/config";

const { corpus } = loadCorpus();
const profile = scenarios[1]!.profile;
const evaluation = evaluateRules(profile, corpus, "2026-08-20");
const question = "What does duration of status mean for my program end date?";
const retrieval = retrieveVerifiedContext(question, corpus, evaluation);
const config = readAiConfig();

const input = {
  question,
  profile: {
    i94Notation: profile.i94Notation,
    academicStage: profile.academicStage,
    optStage: profile.optStage,
    plannedTravel: profile.plannedTravel,
    hasProgramEndDate: Boolean(profile.i20ProgramEndDate),
    hasEadEndDate: Boolean(profile.eadEndDate),
  },
  rules: retrieval.rules.map((r) => ({
    ruleId: r.ruleId,
    title: r.title,
    topic: r.topic,
    legalStatus: String(r.legalStatus),
    headline: r.headline,
    explanation: r.explanation,
    studentImpact: r.studentImpact,
    confirmationNeeded: r.confirmationNeeded,
    pendingEffective: r.pendingEffective,
    isCurrentFinding: r.isCurrentFinding,
    dates: r.dates.map((d) => ({ date: d.date, label: d.label, kind: d.kind })),
    sourceIds: r.sourceIds,
  })),
  sources: retrieval.sources.map((s) => ({
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    legalStatus: String(s.legalStatus),
    verifiedClaims: s.verifiedClaims,
  })),
  recentMessages: [],
  safetyCategory: "informational" as const,
  limits: config.limits,
};

for (const [name, provider] of [
  ["gemini", createGeminiProvider(config.gemini.apiKey, config.gemini.model)],
  ["groq", createGroqProvider(config.groq.apiKey, config.groq.model)],
] as const) {
  try {
    const out = await provider.generateGroundedAnswer(input);
    console.log(name, "OK", JSON.stringify(out.raw).slice(0, 200));
  } catch (error) {
    console.log(name, "FAIL", (error as { kind?: string }).kind, (error as Error).message);
  }
}
