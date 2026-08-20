/**
 * Question classification and the approved responses that go with it.
 *
 * Some questions must never reach an AI provider, however good the retrieval
 * context is — asking "am I still in status?" cannot be answered safely by
 * anything in this product, and a fluent, well-cited wrong answer is worse than
 * no answer. Those questions get fixed, reviewed wording instead.
 *
 * Classification is deliberately conservative and deterministic: it runs before
 * retrieval, on the normalised question, with no model involved.
 */

import { normalizeText } from "./normalizeQuestion";
import type { SafetyCategory } from "./chatTypes";

/* ------------------------------------------------------- approved responses */

/** Asked Stay Valid to determine status, eligibility or a legal outcome. */
export const STATUS_DETERMINATION_RESPONSE =
  "Stay Valid cannot determine whether you are maintaining immigration status. Review the displayed dates and official sources, then confirm your circumstances with your DSO or a qualified immigration attorney.";

/** Retrieval found nothing that supports an answer. */
export const INSUFFICIENT_EVIDENCE_RESPONSE =
  "I could not find enough verified information in the current Stay Valid research corpus to answer that question. Please confirm it with your DSO and consult the linked official government sources.";

/** Outside F-1 educational preparation entirely. */
export const OUT_OF_SCOPE_RESPONSE =
  "Stay Valid currently focuses on educational preparation for F-1 students. It cannot answer this question reliably from its verified sources.";

/** Asked for legal advice or a recommendation on a legal course of action. */
export const LEGAL_ADVICE_RESPONSE =
  "That is a legal question, and Stay Valid is not able to advise on it. It is an educational preparation tool, not a law firm. A qualified immigration attorney — or your DSO, for school-related questions — can advise you on your specific circumstances. Stay Valid can still help you prepare: it can show you the relevant dates, the official sources, and the questions worth asking.";

/** Enforcement, detention, or removal. Never handled by retrieval or AI. */
export const EMERGENCY_RESPONSE =
  "This sounds urgent, and it is beyond what an educational tool should try to answer. Please contact your DSO immediately and speak with a qualified immigration attorney. If you need legal representation and cannot afford it, your school's international student office and your local bar association can point you to accredited low-cost or pro bono immigration help.";

/* ---------------------------------------------------------- classification */

/**
 * Enforcement / emergency. Checked first: these override everything, including
 * an otherwise well-matched informational question.
 */
const EMERGENCY_PATTERNS = [
  /\b(detain|detained|detention|arrest|arrested)\b/,
  /\b(deport|deported|deportation|removal proceedings?|removed from the us)\b/,
  /\b(notice to appear|nta)\b/,
  /\bimmigration (court|judge|raid)\b/,
  /\bice (agents?|officers?|hold|custody)\b/,
  /\b(revoked|terminated) (visa|sevis|status)\b/,
  /\bsevis (record )?(was )?terminated\b/,
];

/**
 * Asks the product to decide the student's status or eligibility.
 * Phrased as questions about the student, not about the rules.
 */
const STATUS_DETERMINATION_PATTERNS = [
  /\bam i (still )?(in|out of|maintaining|violating)\b/,
  /\b(do|did) i (still )?have (valid )?status\b/,
  /\bhave i (lost|violated|broken)\b/,
  /\bam i (legal|illegal|lawful|unlawful|ok|okay|fine|safe|in trouble)\b/,
  /\bis my (status|visa|i-?20|sevis) (still )?(valid|ok|okay|good|active)\b/,
  /\bam i eligible\b/,
  /\bdo i qualify\b/,
  /\bwill (i|my) .*\b(be approved|get approved|qualify|be denied)\b/,
  /\bam i out of status\b/,
];

/** Asks what the student should legally do. */
const LEGAL_ADVICE_PATTERNS = [
  /\bshould i (leave|stay|depart|remain|travel|reenter|re-enter|return|file|apply|sue|appeal)\b/,
  /\b(what|which) should i do\b/,
  /\bdo i (need|have) to (leave|depart|hire)\b/,
  /\bcan i (sue|appeal|fight|challenge)\b/,
  /\bwhat (are|is) my (legal )?(rights|options)\b/,
  /\bis it (legal|illegal|safe|risky) (for me )?to\b/,
  /\bwill i be (deported|removed|banned|barred)\b/,
  /\badvise me\b/,
  /\bwhat would you do\b/,
];

/** Immigration or life topics the corpus does not cover. */
const OUT_OF_SCOPE_PATTERNS = [
  /\bh-?1b\b/,
  /\b(green card|permanent residen|adjustment of status|i-?485)\b/,
  /\b(citizenship|naturaliz)/,
  /\basylum\b/,
  /\b(marriage|marry|spouse) (visa|green card|petition)\b/,
  /\b(j-?1|m-?1|b-?1|b-?2|l-?1|o-?1|tn visa)\b/,
  /\bdaca\b/,
  /\b(tax|taxes|irs|fica|w-?2|1040)\b/,
  /\b(social security|ssn) (number|card|application)\b/,
  /\b(driver'?s? licen[cs]e|dmv)\b/,
  /\b(health insurance|housing|scholarship|tuition|gpa|course registration)\b/,
];

/** Preparation-shaped questions: what to bring, ask, or expect. */
const PREPARATION_PATTERNS = [
  // "what should I bring", "what information should I bring", "what do I ask"
  /\bwhat\b[^.?\n]{0,30}\b(should|do|can) i (bring|ask|discuss|raise|prepare|cover)\b/,
  /\bhow (do|should) i prepare\b/,
  /\b(before|ahead of|prior to) (my|the|an?|any)\b[^.?\n]{0,20}\b(dso|appointment|meeting|travel|trip|departure)\b/,
  /\bquestions? (to|for|i should) ask\b/,
  /\bwhat (documents?|paperwork|forms?|information|records?)\b/,
  /\bchecklist\b/,
  /\bprepare for\b/,
  /\bbring to\b/,
];

export interface Classification {
  category: SafetyCategory;
  /** Set when the category has fixed approved wording. */
  approvedResponse: string | null;
  /**
   * True when the question must not be sent to an AI provider at all.
   * The deterministic layer answers it with the approved response.
   */
  blockAi: boolean;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Classifies a question. Order matters: emergency beats status determination,
 * which beats legal advice, which beats out-of-scope.
 */
export function classifyQuestion(question: string): Classification {
  const text = normalizeText(question);

  if (matchesAny(text, EMERGENCY_PATTERNS)) {
    return {
      category: "legal_advice_request",
      approvedResponse: EMERGENCY_RESPONSE,
      blockAi: true,
    };
  }

  if (matchesAny(text, STATUS_DETERMINATION_PATTERNS)) {
    return {
      category: "dso_confirmation",
      approvedResponse: STATUS_DETERMINATION_RESPONSE,
      blockAi: true,
    };
  }

  if (matchesAny(text, LEGAL_ADVICE_PATTERNS)) {
    return {
      category: "legal_advice_request",
      approvedResponse: LEGAL_ADVICE_RESPONSE,
      blockAi: true,
    };
  }

  if (matchesAny(text, OUT_OF_SCOPE_PATTERNS)) {
    return {
      category: "out_of_scope",
      approvedResponse: OUT_OF_SCOPE_RESPONSE,
      blockAi: true,
    };
  }

  if (matchesAny(text, PREPARATION_PATTERNS)) {
    return { category: "preparation", approvedResponse: null, blockAi: false };
  }

  return { category: "informational", approvedResponse: null, blockAi: false };
}
