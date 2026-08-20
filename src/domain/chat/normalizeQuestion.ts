/**
 * Question normalisation for deterministic retrieval.
 *
 * Students do not write like the Federal Register. They type "i20", "opt",
 * "d/s", "sept 15 rule", "my ead". This module folds that vocabulary onto the
 * terms the corpus actually uses, so retrieval can match without an AI model.
 *
 * Pure and deterministic: the same question always yields the same terms.
 */

/**
 * Words carrying no retrieval signal. Deliberately short — over-aggressive
 * stopword lists strip meaning ("out of status" -> "status").
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "get",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "should",
  "so",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

/**
 * Maps what students type onto corpus vocabulary. Each entry expands to
 * additional search terms; the original token is always kept too.
 *
 * Keys are matched against the normalised text, so multi-word keys work.
 */
const SYNONYMS: Array<[RegExp, string[]]> = [
  // Patterns run against already-canonicalised text, so "i-20"/"I 20"/"i20"
  // have all become "i20" by this point.
  [/\bi20\b/g, ["i20", "program", "end", "date", "sevis"]],
  [/\bi94\b/g, ["i94", "admission", "admit", "until", "date"]],
  [/\bi765\b/g, ["i765", "opt", "filing", "employment", "authorization"]],
  [/\bds\b/g, ["ds", "duration", "status", "admission"]],
  [/\bduration of status\b/g, ["ds", "duration", "status"]],
  [/\bopt\b/g, ["opt", "optional", "practical", "training", "employment"]],
  [/\bstem\b/g, ["stem", "opt", "extension"]],
  [/\bead\b/g, ["ead", "employment", "authorization", "document", "expiration"]],
  [/\bdso\b/g, ["dso", "designated", "school", "official"]],
  [/\bsevis\b/g, ["sevis", "record", "school"]],
  [/\bsevp\b/g, ["sevp", "ice", "school"]],
  [/\buscis\b/g, ["uscis", "immigration", "services"]],
  [/\bdhs\b/g, ["dhs", "homeland", "security"]],
  [/\bcbp\b/g, ["cbp", "border", "admission", "readmission"]],
  [/\bgrace period\b/g, ["grace", "period", "departure", "60"]],
  [/\bsept(?:ember)?\.?\s*15\b/g, ["september", "15", "2026", "transition", "effective"]],
  [/\b9\/15\b/g, ["september", "15", "transition", "effective"]],
  [/\bnew rule\b/g, ["final", "rule", "transition", "admission"]],
  [/\btravel(?:ling|ing)?\b/g, ["travel", "readmission", "reentry", "departure"]],
  [/\bre-?enter(?:ing)?\b/g, ["reentry", "readmission", "travel"]],
  [/\bre-?entry\b/g, ["reentry", "readmission", "travel"]],
  [/\bovers?tay(?:ing|ed)?\b/g, ["unlawful", "presence", "overstay"]],
  [/\bunlawful presence\b/g, ["unlawful", "presence"]],
  [/\bgraduat(?:e|ing|ion)\b/g, ["program", "end", "completion", "grace"]],
  [/\bdeadline\b/g, ["deadline", "date", "filing", "window"]],
  [/\bexpir(?:e|es|ing|ation|y)\b/g, ["expiration", "end", "date"]],
  [/\bextend(?:ing|ed)?\b/g, ["extension", "transition"]],
  [/\bwork(?:ing)?\b/g, ["employment", "authorization", "opt"]],
  [/\bappointment\b/g, ["dso", "meeting", "preparation"]],
  [/\bmeeting\b/g, ["dso", "meeting", "preparation"]],
  [/\blitigation|lawsuit|court|sue[ds]?\b/g, ["litigation", "court", "status", "uncertain"]],
];

export interface NormalizedQuestion {
  /** The question exactly as typed, trimmed. */
  raw: string;
  /** Lowercased, punctuation-folded text used for phrase matching. */
  normalized: string;
  /** Deduplicated search terms, including synonym expansions. */
  terms: string[];
  /** Terms that came straight from the student, before expansion. */
  originalTerms: string[];
}

/**
 * Government form numbers and "D/S" get written half a dozen ways: "I-20",
 * "I 20", "i20", "d/s", "D / S". Collapsing them to one spelling *before*
 * tokenising is what makes retrieval indifferent to how the student typed it —
 * otherwise "I-20" yields the token "i-20" while "I 20" yields "20", and the
 * two questions score differently.
 */
const CANONICAL_FORMS: Array<[RegExp, string]> = [
  [/\bi[-\s]?20\b/g, "i20"],
  [/\bi[-\s]?94\b/g, "i94"],
  [/\bi[-\s]?765\b/g, "i765"],
  [/\bi[-\s]?983\b/g, "i983"],
  [/\bi[-\s]?901\b/g, "i901"],
  [/\bds[-\s]?2019\b/g, "ds2019"],
  [/\bd\s*\/\s*s\b/g, "ds"],
];

/** Folds case, unifies dashes/quotes, canonicalises form numbers. */
export function normalizeText(value: string): string {
  let text = value
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of CANONICAL_FORMS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, replacement);
  }
  return text;
}

function tokenize(normalized: string): string[] {
  return normalized
    .replace(/[^a-z0-9\-/\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[-/]+|[-/]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function normalizeQuestion(question: string): NormalizedQuestion {
  const raw = question.trim();
  const normalized = normalizeText(raw);

  const originalTerms = tokenize(normalized);
  const expanded = new Set<string>(originalTerms);

  for (const [pattern, additions] of SYNONYMS) {
    // Fresh lastIndex each time — these regexes are global and module-level.
    pattern.lastIndex = 0;
    if (pattern.test(normalized)) {
      for (const addition of additions) expanded.add(addition);
    }
  }

  return {
    raw,
    normalized,
    // Sorted so retrieval scoring is order-independent and reproducible.
    terms: [...expanded].sort(),
    originalTerms,
  };
}
