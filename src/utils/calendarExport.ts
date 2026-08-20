/**
 * Client-side .ics generation. No external API, no personal identifiers.
 *
 * Every event description states whether the date is an official date, a date
 * read from the student's own document, or a Stay Valid preparation reminder.
 */

import type { TimelineItem } from "@/domain/types";

const KIND_PREFIX: Record<TimelineItem["kind"], string> = {
  official: "Official date stated by a government source.",
  document: "Date from your own document.",
  reminder: "Stay Valid preparation reminder — not a government deadline.",
  needs_confirmation:
    "Needs confirmation — this date depends on a rule that is not yet in force or is uncertain.",
};

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds long lines at 75 octets, per RFC 5545. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    chunks.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join("\r\n");
}

function icsDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function nextDay(iso: string): string {
  const [y = 0, m = 0, d = 0] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return icsDate(dt.toISOString().slice(0, 10));
}

/**
 * RFC 5545 requires DTSTAMP to be the moment the calendar object was created,
 * in UTC. Passing it in keeps `buildIcs` a pure function so tests get a stable
 * output for a fixed timestamp.
 */
export function buildIcs(
  items: TimelineItem[],
  corpusVersion: string,
  generatedAt: Date = new Date(),
): string {
  const dtstamp = `${generatedAt.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stay Valid//Educational preparation tool//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Stay Valid checkpoints",
  ];

  items
    .filter((item) => item.id !== "today")
    .forEach((item) => {
      const description = [
        KIND_PREFIX[item.kind],
        item.basis,
        "Stay Valid is an educational preparation tool and does not provide legal advice. Verify with your DSO.",
        `Corpus version ${corpusVersion}.`,
      ].join(" ");

      lines.push(
        "BEGIN:VEVENT",
        `UID:${escapeIcs(item.id)}-${icsDate(item.date)}@stayvalid.local`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${icsDate(item.date)}`,
        `DTEND;VALUE=DATE:${nextDay(item.date)}`,
        fold(`SUMMARY:${escapeIcs(`Stay Valid: ${item.label}`)}`),
        fold(`DESCRIPTION:${escapeIcs(description)}`),
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
    });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(items: TimelineItem[], corpusVersion: string): void {
  const blob = new Blob([buildIcs(items, corpusVersion)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "stay-valid-checkpoints.ics";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
