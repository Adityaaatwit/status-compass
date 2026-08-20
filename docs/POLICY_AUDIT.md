# Policy audit

Things noticed in `rules.json` and `sources.json` that a qualified reviewer
should check against primary sources.

**Nothing in this file was changed in the corpus.** The instruction that governs
this work is explicit: *do not change a legal date, threshold or rule merely
because it appears suspicious.* Every item below is recorded, not corrected. The
only entry that produced a code change is §1, and that change alters **how a
missing answer is handled**, not what any rule says.

The corpus is self-declared
`ruleSetStatus: research_draft_requires_human_review`, corpus version
`1.0.0-research`, researched as of 2026-08-19. Every one of the 8 rules carries
`humanReviewRequired: true`. **None of it has been legally verified by this
audit**, which was an engineering review.

---

## 1. Self-reported status was treated as an authoritative determination

**Severity: high. This one produced a code change.**

`rule-f1-transition-existing-ds-student` lists
`maintainingF1StatusOnEffectiveDate` in `appliesWhen.all`. The engine required
the student's answer to be exactly `"yes"`, and because `"unsure"` satisfies no
predicate, answering *"I'm not sure"* removed the rule entirely — no finding, no
note, no trace.

That is a product defect rather than a corpus defect. The corpus is right that
the rule depends on whether status is being maintained; the error was letting a
student's self-assessment act as the determination, and letting its absence read
as a negative determination.

**What changed:** the engine now treats such predicates as *self-reported gates*.
"Yes" still matches but the finding is labelled as resting on the student's own
answer; anything else yields an insufficient-information note directing them to
their DSO.

**What did not change:** the rule, its predicates, its dates, its thresholds, its
`legalStatus`, or its sources.

**For the reviewer:** confirm that `maintainingF1StatusOnEffectiveDate` is the
right gate at all. If the transition provisions apply to a student's *record*
rather than to a self-assessment, the predicate may belong differently — but
that is a legal question, not an engineering one.

---

## 2. The transition cap date lives in code, not in the corpus

`src/domain/evaluateRules.ts`:

```ts
"rule-f1-transition-existing-ds-student": (p, rule) => {
  const TRANSITION_CAP = "2030-11-14";
```

The rule's `calculation.formula` describes the cap in prose, but the operative
date is a literal in a TypeScript calculator. Nothing validates that the two
agree, so editing `rules.json` alone would silently fail to change behaviour.

**Not changed** — moving it would mean editing the corpus schema, which is out of
scope for this pass.

**For the reviewer:** confirm 2030-11-14 against the final rule. Longer term, the
cap belongs in `rules.json` as a structured field with the calculator reading it,
so the corpus stays the single source of truth.

The same applies to every other threshold transcribed into `CALCULATORS`: the
60-day grace period, the 30-day departure period, the 90-day pre-completion and
60-day post-completion OPT filing windows, and the four-year admission cap. Each
is a literal in code that mirrors prose in the corpus.

---

## 3. `activeUntil: 2026-09-14` on the grace-period rule

`rule-f1-program-end-ds-grace-period` retires the day before the September 15
gate, and `rule-f1-transition-existing-ds-student` takes over.

The handover is clean in code — verified by test — but it means a student
evaluating on 2026-09-15 sees a different grace-period treatment from one
evaluating on 2026-09-14, with no explanatory bridge in the UI.

**For the reviewer:** confirm the legacy 60-day grace period genuinely ceases on
that date rather than continuing for students already in it. This is exactly the
kind of transition question where the corpus's own `uncertainty` field would be
worth populating.

---

## 4. A `needs_confirmation` grace period derived from a pending rule

The transition calculator emits a second date:

```
transition end + 60 days -> "End of 60-day grace period after transition end"
kind: needs_confirmation
```

with the basis noting the rule is pending and under litigation. The labelling is
handled correctly. The concern is that the *product* is deriving a grace period
for a regime that is not yet in force, from a 60-day figure that belongs to the
current regime.

**Not changed** — it is labelled honestly and gated properly.

**For the reviewer:** confirm the 60-day grace period carries over to the
transition framework at all. If it does not, this date should be removed rather
than relabelled.

---

## 5. Sources marked `verified` that are not primary authority

Three tier-2/tier-3 sources carry `verificationStatus: verified`:

| ID | Tier | Type |
| --- | --- | --- |
| `nafsa-duration-status-explainer` | 3 | Membership-association explainer |
| `pie-news-lawsuit` | 3 | Trade press |
| `nafsa-trump-vance-update` | 3 | Membership-association update |

"Verified" here appears to mean *"we confirmed this document says what we quote"*
rather than *"this is primary authority"*. Those are different claims, and the
schema does not distinguish them — `sourceTier` does, but only if a reader knows
to look.

Retrieval treats them as citable. The UI shows the tier.

**For the reviewer:** consider whether tier-3 commentary should be citable in a
student-facing answer at all, or shown only as context.

Separately, `regs-iceb-2025-0001-ria` is `partially_verified` and is therefore
**excluded** from chat citations entirely. That may be stricter than intended for
a tier-1 document — worth a decision either way.

---

## 6. Two sources have no `publishedAt`

`regs-iceb-2025-0001` and `ecfr-8cfr-214-1` / `ecfr-8cfr-214-2f` have
`publishedAt: null`. For eCFR sections this is defensible — they are living
documents. For the regulations.gov docket it looks like a gap.

The staleness logic keys off `lastCheckedAt`, so nothing is broken. Recorded for
completeness.

---

## 7. `corpusVersion` is duplicated across two files

`rules.json` and `sources.json` each declare `corpusVersion: "1.0.0-research"`,
and `validateCorpus` warns if they diverge. `candidate-updates.json` has no
`corpusVersion` at all, only `researchedAsOf`.

A single manifest would remove the possibility of drift.

---

## 8. `researchedAsOf` carries a timezone offset

```json
"researchedAsOf": "2026-08-19T23:59:59-04:00"
```

Everything else in the corpus is a plain `yyyy-mm-dd` in UTC, deliberately, so
the engine is timezone-independent. This one field is a timestamp with an offset.
It is used only for display and is normalised safely by `formatDateTime`, so no
calculation depends on it — but it is an inconsistency worth resolving.

---

## Summary for the reviewer

Highest value first:

1. **§1** — confirm the transition rule's dependency on self-reported status.
   Code already fails safe; the legal question stands.
2. **§2** — verify 2030-11-14 and the other hard-coded thresholds against
   primary sources, then consider moving them into `rules.json`.
3. **§3 / §4** — the grace-period handover across the September 15 gate, and
   whether a 60-day grace period carries into the transition framework.
4. **§5** — whether tier-3 commentary should be citable to students.
5. **§6–§8** — schema hygiene, no behavioural impact.
