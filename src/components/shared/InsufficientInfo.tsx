import { HelpCircle } from "lucide-react";

import { INSUFFICIENT_INFO_MESSAGE } from "@/domain/evaluateRules";
import type { InsufficientInfoNote } from "@/domain/types";

export function InsufficientInfo({ notes }: { notes: InsufficientInfoNote[] }) {
  if (notes.length === 0) return null;
  const missing = [...new Set(notes.flatMap((n) => n.missingInputs))];

  return (
    <section aria-labelledby="insufficient-heading" className="sv-card p-5">
      <div className="flex items-start gap-3">
        <HelpCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-attn-confirm" />
        <div>
          <h3 id="insufficient-heading" className="text-base font-semibold text-foreground">
            More information or DSO confirmation is needed
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{INSUFFICIENT_INFO_MESSAGE}</p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Missing information
          </h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((item) => (
              <li
                key={item}
                className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {notes.map((note) => (
          <li key={note.ruleId}>
            <span className="font-medium text-foreground">{note.ruleTitle}</span> — could not be
            evaluated with the information provided.
          </li>
        ))}
      </ul>
    </section>
  );
}
