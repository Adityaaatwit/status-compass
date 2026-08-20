/**
 * Detects legal identifiers a student should never type into a chat box.
 *
 * This runs in the browser *before* a message is added to the conversation, so
 * a blocked message is never sent anywhere and never enters history. It is a
 * guard rail, not a guarantee: it is deliberately tuned to catch the common
 * shapes (SEVIS N-numbers, A-numbers, USCIS receipt numbers, passport numbers)
 * without flagging ordinary dates and counts like "60 days" or "2026".
 *
 * When it fires, the correct product behaviour is to refuse to send and ask the
 * student to remove the number — never to send a redacted version, because a
 * redaction bug would leak the very thing being redacted.
 */

export type IdentifierKind =
  "sevis_id" | "a_number" | "receipt_number" | "passport_number" | "long_numeric_id";

export interface DetectedIdentifier {
  kind: IdentifierKind;
  /** Human-readable name shown to the student. Never echoes the value. */
  label: string;
}

interface Detector {
  kind: IdentifierKind;
  label: string;
  pattern: RegExp;
}

/**
 * Three-letter service-centre prefixes used on USCIS receipt notices.
 * Listing them explicitly avoids flagging any three letters plus digits.
 */
const RECEIPT_PREFIXES = "(?:EAC|WAC|LIN|SRC|NBC|MSC|IOE|YSC|NSC|TSC|VSC|CSC)";

const DETECTORS: Detector[] = [
  {
    // SEVIS IDs are N followed by 9-11 digits, often written "N0012345678".
    kind: "sevis_id",
    label: "a SEVIS ID",
    pattern: /\bN[-\s]?\d{9,11}\b/i,
  },
  {
    // A-numbers: "A" plus 8 or 9 digits, commonly written A123456789 or A 12 345 678.
    kind: "a_number",
    label: "an A-number",
    pattern: /\bA[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{2,3}\b/i,
  },
  {
    kind: "receipt_number",
    label: "a USCIS receipt number",
    pattern: new RegExp(`\\b${RECEIPT_PREFIXES}[-\\s]?\\d{10}\\b`, "i"),
  },
  {
    // Passport numbers vary by country; the common machine-readable shape is
    // 1-2 letters followed by 6-8 digits. Require a passport cue word nearby to
    // keep this from flagging course codes.
    kind: "passport_number",
    label: "a passport number",
    pattern: /\bpassport\b[^.\n]{0,40}?\b[A-Z]{1,2}\d{6,8}\b/i,
  },
  {
    // Catch-all for any unusually long run of digits. Dates, years, day counts
    // and dollar amounts are all well under 9 digits.
    kind: "long_numeric_id",
    label: "a long identification number",
    pattern: /\b\d{9,}\b/,
  },
];

/**
 * Returns every identifier kind detected. Empty array means the message is
 * safe to send.
 */
export function detectIdentifiers(text: string): DetectedIdentifier[] {
  const found = new Map<IdentifierKind, DetectedIdentifier>();
  for (const detector of DETECTORS) {
    if (detector.pattern.test(text)) {
      found.set(detector.kind, { kind: detector.kind, label: detector.label });
    }
  }
  return [...found.values()];
}

export function containsIdentifier(text: string): boolean {
  return detectIdentifiers(text).length > 0;
}

/**
 * The message shown when sending is blocked. Names the kinds detected but never
 * repeats the value itself.
 */
export function identifierWarning(found: DetectedIdentifier[]): string {
  if (found.length === 0) return "";
  const labels = found.map((f) => f.label);
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `That message looks like it contains ${list}. Stay Valid does not need it and will not send it. Please remove the number and ask your question again — you can describe the document instead, for example "my I-20" or "my receipt notice".`;
}
