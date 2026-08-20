import { Link } from "@tanstack/react-router";
import { ArrowRight, HelpCircle, ShieldQuestion } from "lucide-react";
import { useMemo, useState } from "react";

import { StudentSupportIllustration } from "@/components/illustrations/StudentSupportIllustration";
import { INSUFFICIENT_INFO_MESSAGE } from "@/domain/evaluateRules";
import {
  REQUIRED_INPUT_TO_FIELD,
  getQuestion,
  type IntakeFieldId,
} from "@/domain/intakeQuestions";
import type { InsufficientInfoNote } from "@/domain/types";

/**
 * Two different reasons a rule could not run, deliberately kept apart:
 *
 *  - `missing_input`      the student can fix by answering one more question,
 *                         so it is presented as a compact guided action with a
 *                         direct link back to that question;
 *  - `self_reported_gate` the student cannot fix at all, because the answer
 *                         depends on a status determination Stay Valid is not
 *                         allowed to make.
 */
export function InsufficientInfo({ notes }: { notes: InsufficientInfoNote[] }) {
  if (notes.length === 0) return null;

  const missingInput = notes.filter((n) => n.reason === "missing_input");
  const dsoGated = notes.filter((n) => n.reason === "self_reported_gate");

  return (
    <section aria-labelledby="insufficient-heading" className="space-y-4">
      <h2 id="insufficient-heading" className="text-xl font-semibold text-foreground">
        Complete these to unlock more of your plan
      </h2>

      {missingInput.length > 0 && <GuidedMissingInputs notes={missingInput} />}

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
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface Gap {
  field: IntakeFieldId;
  shortLabel: string;
  whyNeeded: string;
  ruleTitles: string[];
}

function GuidedMissingInputs({ notes }: { notes: InsufficientInfoNote[] }) {
  const gaps = useMemo(() => collectGaps(notes), [notes]);

  if (gaps.length === 0) {
    return (
      <div className="sv-card p-5">
        <h3 className="text-base font-semibold text-foreground">
          A personalized calculation is not possible yet
        </h3>
        <p className="sv-prose mt-1 text-sm text-muted-foreground">{INSUFFICIENT_INFO_MESSAGE}</p>
        <p className="mt-3 text-sm text-foreground">
          General preparation still applies: bring your I-20 and I-94 to your DSO, and read the
          official sources rather than a summary of them.
        </p>
        <Link
          to="/sources"
          className="sv-transition mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
        >
          Review the official sources
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    );
  }

  const headline =
    gaps.length === 1
      ? "One more detail will complete this checkpoint"
      : `${gaps.length} more details will complete these checkpoints`;

  return (
    <div className="sv-card p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <HelpCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-attn-prepare" />
            <div>
              <h3 className="text-base font-semibold text-foreground">{headline}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your existing answers are kept. You will come straight back here.
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {gaps.map((gap) => (
              <GapRow key={gap.field} gap={gap} />
            ))}
          </ul>
        </div>

        <StudentSupportIllustration
          decorative
          className="hidden h-28 w-auto shrink-0 sm:block"
        />
      </div>
    </div>
  );
}

function GapRow({ gap }: { gap: Gap }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-border bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/check"
          search={{ focus: gap.field, from: "plan" }}
          className="sv-transition inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
        >
          Add {gap.shortLabel.toLowerCase()}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-sm font-medium text-accent underline underline-offset-2"
        >
          Why we need this
        </button>
      </div>
      {open && (
        <div className="mt-2 text-sm text-muted-foreground">
          <p>{gap.whyNeeded}</p>
          {gap.ruleTitles.length > 0 && (
            <p className="mt-1 text-xs">Waiting on it: {gap.ruleTitles.join("; ")}</p>
          )}
        </div>
      )}
    </li>
  );
}

/** One row per missing question, not per blocked rule. */
function collectGaps(notes: InsufficientInfoNote[]): Gap[] {
  const byField = new Map<IntakeFieldId, Gap>();
  for (const note of notes) {
    for (const key of note.missingInputKeys ?? []) {
      const field = REQUIRED_INPUT_TO_FIELD[key];
      if (!field) continue;
      const question = getQuestion(field);
      if (!question) continue;
      const existing = byField.get(field);
      if (existing) {
        if (!existing.ruleTitles.includes(note.ruleTitle)) existing.ruleTitles.push(note.ruleTitle);
      } else {
        byField.set(field, {
          field,
          shortLabel: question.shortLabel,
          whyNeeded: question.whyNeeded,
          ruleTitles: [note.ruleTitle],
        });
      }
    }
  }
  return [...byField.values()];
}
