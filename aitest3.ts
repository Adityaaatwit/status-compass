import { readAiConfig } from "@/server/ai/config";
import { GroundedAnswerSchema } from "@/server/ai/outputSchema";
const config = readAiConfig();
const { loadCorpus } = await import("@/domain/dataAdapters");
const { evaluateRules } = await import("@/domain/evaluateRules");
const { scenarios } = await import("@/domain/scenarios");
const { retrieveVerifiedContext } = await import("@/domain/chat/retrieveVerifiedContext");
const { SYSTEM_PROMPT, buildContextText, buildUserPrompt } = await import("@/server/ai/prompt");
const { corpus } = loadCorpus();
const profile = scenarios[1]!.profile;
const evaluation = evaluateRules(profile, corpus, "2026-08-20");
const question = "What does duration of status mean for my program end date?";
const retrieval = retrieveVerifiedContext(question, corpus, evaluation);
const input: any = {
  question,
  profile: { i94Notation: profile.i94Notation, academicStage: profile.academicStage, optStage: profile.optStage, plannedTravel: profile.plannedTravel, hasProgramEndDate: true, hasEadEndDate: false },
  rules: retrieval.rules,
  sources: retrieval.sources,
  recentMessages: [],
  safetyCategory: "informational",
  limits: config.limits,
};
const ctx = buildContextText(input);
const up = buildUserPrompt(input, ctx);
const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${config.groq.apiKey}` },
  body: JSON.stringify({ model: config.groq.model, temperature: 0.2, max_tokens: config.limits.maxOutputTokens, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: up }] }),
});
const j: any = await r.json();
const c = j.choices?.[0];
console.log("status", r.status, "finish", c?.finish_reason, "usage", JSON.stringify(j.usage));
const txt = c?.message?.content ?? "";
console.log("len", txt.length, "tail", txt.slice(-120));
let parsed: any = null;
try { parsed = JSON.parse(txt); } catch (e) { console.log("parse fail"); }
if (parsed) {
  const v = GroundedAnswerSchema.safeParse(parsed);
  console.log("zod", v.success, v.success ? "" : JSON.stringify(v.error.issues).slice(0, 400));
}
