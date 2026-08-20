# Stay Valid — engineering audit and change record

Audit performed on the repository as cloned from
`Adityaaatwit/status-compass` at commit `b7e53fe` ("Renamed project to Stay
Valid"). Work landed on branch `claude/hardening-and-grounded-chat`.

---

## 1. Baseline, before any change

### 1.1 Environment

The repository ships `bun.lock` and `bunfig.toml`, but Bun was not available on
the audit machine. `npm install` was used instead; `package-lock.json` is
gitignored so it cannot compete with `bun.lock` as the canonical lockfile.

### 1.2 Baseline results

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | **Pass**, no errors |
| Tests | `npx vitest run` | **Pass**, 36 tests in 1 file |
| Production build | `npm run build` | **Pass**, Cloudflare Worker output generated |
| Lint | `npx eslint .` | **Fail — 9,074 errors, 12 warnings** |

### 1.3 The lint failure was environmental, not a code defect

All 9,074 errors were `Delete ␍` from `prettier/prettier`. The repository has no
`.gitattributes`, so a Windows checkout with `core.autocrlf=true` rewrote every
file to CRLF, which Prettier rejects. Underneath that noise sat **38 genuine
formatting errors** — the repo had simply never been run through Prettier.

Fixed by adding `.gitattributes` with `* text=auto eol=lf` and re-normalising.
Lint is now clean apart from 12 `react-refresh/only-export-components` warnings,
all in unmodified shadcn/ui boilerplate.

### 1.4 Missing scripts

`vitest` was a dependency with no `test` script; there was no `typecheck` script
either. The README told contributors to run `npx vitest run` directly. Added
`test`, `test:watch`, `typecheck` and `verify`.

---

## 2. Architecture as found

The generated architecture is genuinely good and was preserved rather than
rewritten. Nothing in the audit justified a rewrite.

```
src/data/*.json      research corpus — read-only source of truth
src/domain/          pure functions: no React, no I/O, no clock reads
src/hooks/           in-memory session state
src/components/      presentation
src/routes/          TanStack Start file-based routes
```

**Load path:** `dataAdapters.loadCorpus()` normalises raw JSON into typed
records once at module load, and `dataValidation.validateCorpus()` reports
whether the result is usable without ever rewriting it. Downstream code never
touches raw JSON.

**Engine:** `evaluateRules(profile, corpus, asOfDate)` is pure. The clock is
never read inside it — `asOfDate` is captured once per session in
`useStayValid` and threaded through. This is what makes determinism testable,
and it was correct as found.

**Corpus contents:** 8 rules, 18 sources, 3 candidate updates, corpus version
`1.0.0-research`, `ruleSetStatus: research_draft_requires_human_review`. Every
rule carries `humanReviewRequired: true`.

---

## 3. Bugs found and fixed

### 3.1 Self-reported status silently suppressed the most important rule — *high severity*

`rule-f1-transition-existing-ds-student` is the rule that matters most to
existing D/S students. It is gated on the predicate
`maintainingF1StatusOnEffectiveDate`, which required the profile answer to be
exactly `"yes"`. Because `"unsure"` satisfies no predicate, a student answering
*"I'm not sure"* — an entirely reasonable answer, since only a DSO can confirm —
had the rule dropped with **no finding and no note**. The page simply did not
mention it.

Silence there reads as *"this does not apply to you"*, which is precisely the
status determination the product forbids itself from making.

**Fix.** Such predicates are now modelled explicitly as *self-reported gates*.
Answering "yes" still matches, but the resulting finding carries the gate so the
UI states that it rests on the student's own answer. Any other answer produces
an insufficient-information note pointing at the DSO instead of a silent skip.
`InsufficientInfoNote` gained a `reason` discriminator so the UI can separate
*"you have not told us a date"* from *"nobody here can answer this"*.

No legal date, threshold, or rule was changed. See
[`POLICY_AUDIT.md`](./POLICY_AUDIT.md) §1.

### 3.2 `buildTimeline.dsoFollowUp` — three defects in one function

```ts
const remind = diffInDays("1970-01-01", anchor) === null ? null : anchor;
```

- The guard was a no-op: it computed a diff, compared it to null, and returned
  `anchor` either way.
- The `basis` text claimed the reminder was tied to the student's *earliest* key
  date, but the code used `??` — first non-null, which for a STEM OPT student is
  the program end date even when the EAD expires sooner.
- The reminder landed **on** the anchor date, duplicating the document row on
  the timeline and implying the student should see their DSO the day their I-20
  expired.

**Fix.** Uses `minDate` (genuinely earliest), offsets 45 days ahead, and is
suppressed entirely when that would fall in the past.

### 3.3 `.ics` export produced invalid `DTSTAMP`

`DTSTAMP` carried the *event* date, not the generation time, which violates RFC
5545 §3.8.7.2. Now injected as a parameter, keeping `buildIcs` pure and testable.

### 3.4 Landing page contradicted the engine

The homepage preview labelled the 15 September 2026 policy checkpoint with an
**"Official date"** badge. The engine correctly emits scheduled effective dates
as `needs_confirmation`, because publication is not proof a rule is in force.
The marketing copy asserted something the product deliberately refuses to.

### 3.5 "Clear my information" did not clear the conversation

Found after adding chat. The header button reset the profile but left the
questions and answers on screen. The provider now exposes `clearCount`; the chat
panel is keyed on it, so a clear discards the conversation and the AI
acknowledgement too.

### 3.6 Research citation markers leaked into user-facing text

Found by running the app rather than by reading it. The `/plan` page displayed
**41 occurrences** of raw research markers — `[page:1][web:18][web:53]` — inside
finding explanations, headlines, student-impact text and rationale.

`stripCitationMarkers` had existed since the original generation, with a docstring
saying exactly what it was for. It was wired only into `strArray`, so every
*array* field was cleaned and every *scalar* field was not — and scalars are most
of what a student reads.

**Fix.** Added `displayString` / `nullableDisplayString` in the adapter and
applied them to every scalar the UI can render, across rules, sources and
candidate updates. Provenance belongs in the source cards, not mid-sentence.
Verified live: 41 → 0. A test now walks the whole corpus and asserts no marker
survives into any displayable field.

### 3.7 `.gitignore` had no `.env` entries

`.dev.vars` was covered; `.env`, `.env.local` and `.env.*.local` were not. Fixed
before any secret-bearing code was written.

---

## 4. Security review

| Area | Finding |
| --- | --- |
| Secrets in client bundle | **Verified absent.** `GEMINI_API_KEY`, `GROQ_API_KEY`, both provider hostnames, the auth headers, the system prompt and `readAiConfig` each appear in **zero** files under `.output/public/`, and all appear in `.output/server/`. |
| Server-only enforcement | Every module in `src/server/ai/` carries `import "@tanstack/react-start/server-only"`. The framework's import-protection plugin additionally denies any client-reachable import under `**/server/**` — it rejected the first wiring attempt, which is the guard working. `createServerFn` therefore lives in `src/rpc/`, the implementation in `src/server/ai/`. |
| Untrusted input | The RPC re-validates the profile with Zod rather than trusting the wire, and **re-runs retrieval and evaluation server-side**, so a crafted request cannot smuggle arbitrary text into the model prompt. |
| Prompt injection | Corpus text and student messages are fenced and labelled untrusted in the prompt, but the prompt is *not* relied upon — `validateGroundedOutput` is the actual boundary, and is tested against an injection attempt. |
| Identifier leakage | Detected in the browser before a message enters the conversation, and again server-side. Blocks rather than redacts: a redaction bug leaks exactly what it is meant to hide. |
| Logging | No question text, answer body, or profile date is logged. Only a coarse fallback reason. |
| Rate-limit key | The client IP is used solely as an in-memory bucket key for the current isolate; never stored, logged, or attached to a question. |
| Dependencies | **No new runtime dependencies.** Providers use `fetch`, not SDKs. |

### Known limitation

Rate-limit and circuit-breaker state is per-isolate module memory. On Cloudflare
Workers that means it is best-effort, not a global counter. It is sized to stop
one tab or one broken retry loop from draining a free tier, which is its actual
purpose; a global limit would need Durable Objects or KV, which the brief
excludes. Documented in [`HANDOFF.md`](./HANDOFF.md).

---

## 5. Rule-engine review

**Sound as found:**

- Purity and determinism hold; `asOfDate` is never read from the clock.
- `doNotActivateBefore` / `activeFrom` / `activeUntil` gating is correct, and the
  gate comparison is inclusive on the boundary day (now tested explicitly).
- `NON_OPERATIVE_STATUSES` correctly prevents delayed/stayed/enjoined/terminated
  /superseded/uncertain rules from producing legal deadlines.
- Pending-effective attention downgrade cannot yield `confirm_now`.
- Candidate updates genuinely cannot activate a rule — `mustNotActivateRules` is
  forced to `true` in the adapter regardless of file contents, and the engine
  reads `candidates` only to list related updates.

**Corrected:** the self-reported gate handling in §3.1.

**Noted, not changed** — recorded in `POLICY_AUDIT.md`:

- Every rule carries `humanReviewRequired: true` and the rule set is a research
  draft. The UI surfaces this; it is not an engineering defect.
- `expectedReentryOnOrAfterEffectiveDate` returns `true` for a student with
  travel planned but no reentry date. Deliberate and reasonable (an unplanned
  return still merits the review) but it is a judgement call in code rather than
  in the corpus.

---

## 6. Accessibility review

Fixed or built in:

- Chat input has a real `<label>`, an `aria-describedby` hint, an `aria-live`
  conversation log, and `role="alert"` on the identifier block.
- Focus returns to the input after each send; scroll-into-view uses
  `block: "nearest"` so it never steals focus.
- The loading pulse carries `motion-reduce:animate-none`.
- Enter/Shift+Enter handling guards `isComposing`, without which every IME user
  sends a half-typed word.
- External source links announce "(opens in a new tab)" to screen readers.

Pre-existing and confirmed good: skip-to-content link, badges pair colour with
both an icon and a text label (never colour alone), semantic landmarks
throughout.

Not addressed: no automated axe run and no screen-reader pass on real hardware.
Listed as remaining work.

---

## 7. Performance review

- Corpus is ~101 KB of JSON bundled at build time; `loadCorpus()` runs once at
  module scope, not per render.
- Retrieval is a linear scan over 8 rules and 18 sources — trivially fast, and it
  keeps the chat usable with no network.
- Derived views are memoised in `useStayValid` on `[profile, asOfDate,
  hasAnswers, scenarioLabel]`.
- No AI call on page load, and none for the timeline, checklist, pathways or
  meeting kit.
- Chat history is capped in memory and truncated before transmission.

At corpus scale this is not a bottleneck. If the corpus grows past a few hundred
rules, retrieval should move to an inverted index — noted in `HANDOFF.md`.

---

## 8. Changes completed

1. **Baseline fixes** — `.gitattributes`, scripts, `.gitignore`, Prettier pass,
   the five bugs in §3, self-reported gate handling.
2. **Deterministic retrieval** — `src/domain/chat/`: normalisation, retrieval,
   safety classification, identifier detection, deterministic answer builder.
3. **Server AI** — `src/server/ai/` + `src/rpc/askStayValid.ts`: provider
   abstraction, Gemini and Groq over `fetch`, Zod schema plus semantic
   validation, quota protection, `.env.example`.
4. **Ask Stay Valid UI** — chat panel on `/plan`, answering locally by default.
5. **Privacy** — rewritten privacy page, complete clear action.
6. **Tests and documentation** — this file and the four alongside it.

### Verification at completion

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (0 errors, 12 pre-existing shadcn/ui warnings) |
| `npm run test` | **258 tests, 12 files, all passing** (baseline: 36) |
| `npm run build` | Pass |
| Client bundle secret scan | Clean |

---

## 9. Remaining work

**Correctness / policy**

- A qualified reviewer must sign off `rules.json` before public use. The corpus
  is self-declared `research_draft_requires_human_review` and every rule sets
  `humanReviewRequired`. Nothing in this audit verified the underlying law.
- Items in [`POLICY_AUDIT.md`](./POLICY_AUDIT.md) need a primary-source check.

**Engineering**

- No component or integration tests — the UI is covered only indirectly. A
  Testing Library pass over the chat panel (Enter vs Shift+Enter, disclosure
  gating, identifier block) would be the highest-value addition.
- No automated accessibility test; no real screen-reader pass.
- Retrieval is a linear scan; fine now, would need an index at 100× the corpus.
- Rate limiting is per-isolate (see §4).
- `safeJsonParse` is exported from `geminiProvider` and reused by
  `groqProvider`; it belongs in a shared module.
- The corpus loads eagerly at module scope, which puts ~101 KB in the initial
  client bundle. Splitting rules from sources would help first paint.
