import { HelpCircle, ShieldQuestion } from "lucide-react";

import { INSUFFICIENT_INFO_MESSAGE } from "@/domain/evaluateRules";
import type { InsufficientInfoNote } from "@/domain/types";

/**
 * Two different reasons a rule could not run, deliberately kept apart:
 *
 *  - `missing_input`      the student can fix by typing a date;
 *  - `self_reported_gate` the student cannot fix at all, because the answer
 *                         depends on a status determination Stay Valid is not
 *                         allowed to make.
 *
 * Collapsing them into one "missing information" list would imply the second
 * kind is the student's oversight, and would hide the fact that a significant
 * rule was withheld precisely because its answer is unknown.
 */
export function InsufficientInfo({ notes }: { notes: InsufficientInfoNote[] }) {
  if (notes.length === 0) return null;

  const missingInput = notes.filter((n) => n.reason === "missing_input");
  const dsoGated = notes.filter((n) => n.reason === "self_reported_gate");
  const missing = [...new Set(missingInput.flatMap((n) => n.missingInputs))];

  return (
    <section aria-labelledby="insufficient-heading" className="space-y-4">
      <h2 id="insufficient-heading" className="text-2xl font-semibold text-foreground">
        Not evaluated
      </h2>

      {dsoGated.length > 0 && (
        <div className="sv-card border-l-4 border-l-attn-confirm p-5">
          <div className="flex items-start gap-3">
            <ShieldQuestion
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-attn-confirm"
            />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Only your DSO can answer this
              </h3>
              <p className="sv-prose mt-1 text-sm text-muted-foreground">
                Stay Valid held these topics back rather than assuming an answer. Their absence does
                not mean they do not apply to you.
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {dsoGated.map((note) => (
              <li key={note.ruleId} className="rounded-lg border border-border bg-paper p-3">
                <p className="text-sm font-medium text-foreground">{note.ruleTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{note.message}</p>
                {note.missingInputs.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Depends on: {note.missingInputs.join("; ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {missingInput.length > 0 && (
        <div className="sv-card p-5">
          <div className="flex items-start gap-3">
            <HelpCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-attn-prepare" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                More information is needed
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
            {missingInput.map((note) => (
              <li key={note.ruleId}>
                <span className="font-medium text-foreground">{note.ruleTitle}</span> — could not be
                evaluated with the information provided.
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
