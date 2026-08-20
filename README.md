# Stay Valid

**Status compass for F-1 international students.** Stay Valid turns U.S. immigration
policy into a personal timeline, a set of checkpoints, an evidence trail, and a
printable DSO meeting kit — without ever telling a student what their legal status
*is*.

Everything a student sees is produced by a **deterministic rules engine** running
over a **hand-verified corpus** of primary sources. An optional AI layer can
*explain* what the engine already found, but it can never invent a rule, a date,
or a citation.

> Educational tool only. Stay Valid is not legal advice and does not replace a
> Designated School Official (DSO) or an immigration attorney.

---

## Table of contents

1. [What the product does](#1-what-the-product-does)
2. [Design principles](#2-design-principles)
3. [Tech stack](#3-tech-stack)
4. [Getting started](#4-getting-started)
5. [Project structure](#5-project-structure)
6. [Data layer — the verified corpus](#6-data-layer--the-verified-corpus)
7. [Domain layer — the deterministic engine](#7-domain-layer--the-deterministic-engine)
8. [Application layer — routes, state, components](#8-application-layer--routes-state-components)
9. [Ask Stay Valid — the grounded AI layer](#9-ask-stay-valid--the-grounded-ai-layer)
10. [Privacy and security model](#10-privacy-and-security-model)
11. [Design system](#11-design-system)
12. [Testing and verification](#12-testing-and-verification)
13. [Configuration reference](#13-configuration-reference)
14. [Deployment](#14-deployment)
15. [Extending the project](#15-extending-the-project)

---

## 1. What the product does

A student answers a short, dependency-aware intake (classification, I-94 notation,
I-20 program dates, academic stage, OPT/STEM stage, EAD dates, travel plans,
goals). From those answers alone the engine produces:

| Output | Where | What it is |
| --- | --- | --- |
| **At a glance** | `/plan` | Summary tiles: next deadline, items needing confirmation, corpus version, as-of date |
| **Horizontal timeline** | `/plan` | Every derived date in chronological order, badged by kind (hard deadline, window, monitor, informational) |
| **Findings** | `/plan` | Rule-by-rule cards: headline, plain-language explanation, student impact, attention level, citations |
| **Pathway map** | `/plan` | Branching options (e.g. OPT → STEM OPT → H-1B, transfer, change of level) with prerequisites and risks |
| **Action roadmap** | `/plan` | Three-column checklist grouped by urgency: confirm now / prepare / monitor |
| **Evidence & records table** | `/plan` | Every claim mapped to its source, publisher, legal status, verification status, and retrieval date |
| **DSO meeting kit** | `/plan` | Print-optimised agenda + question list + record checklist, with an email handoff (mail app / Outlook deep link) |
| **Calendar export** | `/plan` | `.ics` file of all timeline dates |
| **Research transparency** | `/sources` | Full source list, legal-status chips, candidate (not-yet-final) updates |
| **Privacy statement** | `/privacy` | What is stored, what is sent, what is never sent |
| **Ask Stay Valid** | `/plan` | Grounded Q&A over the retrieved rules only (see §9) |

### The hard product rule

Stay Valid **never adjudicates status**. Any question of the form "am I in status?",
"will I be approved?", "is this legal for me?" is classified locally and answered
with a referral to the DSO. Self-reported facts that would be needed to adjudicate
(e.g. "am I maintaining status?") are surfaced as **self-reported gates** rather
than silently trusted.

---

## 2. Design principles

1. **Deterministic first.** Every date, deadline, and checklist item comes from
   pure functions over JSON. Same inputs → same outputs, always, offline.
2. **AI is an explainer, never an authority.** The AI layer receives only
   already-retrieved rules and may only rephrase them. Its output is schema- and
   content-validated against that context before display; anything unverifiable
   is discarded and the deterministic answer is shown instead.
3. **Nothing leaves the browser unless it must.** Intake answers live in
   `sessionStorage` only. With AI disabled the app makes zero network calls.
4. **Every claim is cited.** No UI string asserts a rule without a source ID that
   resolves to a real primary document.
5. **Missing input is a first-class state.** The engine reports *which* inputs are
   missing (`missingInputKeys`) instead of guessing.
6. **Accessible and printable.** Keyboard-navigable, semantic landmarks, visible
   focus rings, reduced-motion respected, and a print stylesheet for the DSO kit.

---

## 3. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **TanStack Start v1** (React 19, SSR + server functions) |
| Router | **TanStack Router** — file-based routes in `src/routes/` |
| Build | **Vite 8** |
| Language | **TypeScript 5.8**, strict |
| Styling | **Tailwind CSS v4** via `src/styles.css` (`@theme`, OKLCH tokens) |
| Components | **shadcn/ui** on Radix primitives, `lucide-react` icons |
| Validation | **Zod** (corpus validation + server-function input) |
| Data fetching | **TanStack Query** (only for the one AI endpoint) |
| Dates | **date-fns** |
| Tests | **Vitest** |
| Lint/format | ESLint 9 (typescript-eslint) + Prettier |
| Runtime target | Edge / Cloudflare Workers (`nodejs_compat`) |

No database. No auth. No analytics. No tracking.

---

## 4. Getting started

```bash
npm install
npm run dev          # http://localhost:8080
```

Optional AI layer:

```bash
cp .env.example .env   # then paste a GEMINI_API_KEY and/or GROQ_API_KEY
```

Scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run verify` | typecheck → lint → test → build (the release gate) |

---

## 5. Project structure

```
src/
├── data/                          # the verified corpus (JSON, source of truth)
│   ├── rules.json                 # 8 F-1 rules, versioned + researched-as-of
│   ├── sources.json               # 18 primary sources with legal status
│   └── candidate-updates.json     # 3 proposed/not-final changes, kept separate
│
├── domain/                        # pure TypeScript. no React, no I/O
│   ├── types.ts                   # every domain type (corpus, profile, results)
│   ├── dataValidation.ts          # Zod validation of the corpus at load
│   ├── dataAdapters.ts            # loadCorpus(), citation-marker stripping, lookups
│   ├── dateCalculations.ts        # grace periods, windows, day math
│   ├── evaluateRules.ts           # THE engine: profile + corpus → EvaluationResult
│   ├── buildTimeline.ts           # findings → ordered TimelineItem[]
│   ├── buildPathways.ts           # findings → PathwayCard[]
│   ├── buildChecklist.ts          # findings → ChecklistAction[] by urgency
│   ├── buildMeetingKit.ts         # findings → MeetingKit (agenda, questions, records)
│   ├── intakeQuestions.ts         # dependency-aware question registry
│   ├── scenarios.ts               # canonical demo profiles
│   └── chat/                      # browser-safe chat logic
│       ├── chatTypes.ts
│       ├── safety.ts              # question classification + AI block list
│       ├── identifierDetection.ts # PII / identifier detection (SEVIS, A#, SSN…)
│       ├── normalizeQuestion.ts
│       ├── retrieveVerifiedContext.ts   # local retrieval over the corpus
│       └── buildDeterministicAnswer.ts  # answer with zero AI
│
├── server/ai/                     # server-only. marked, never bundled to client
│   ├── config.ts                  # env reading, clamped limits, provider choice
│   ├── prompt.ts                  # the grounded system prompt
│   ├── provider.ts                # AiChatProvider contract + shareable payload types
│   ├── geminiProvider.ts          # Gemini implementation
│   ├── groqProvider.ts            # Groq implementation
│   ├── outputSchema.ts            # schema + grounding validation of model output
│   ├── errors.ts                  # AiError taxonomy, fallback eligibility
│   ├── rateLimit.ts               # per-client limits, dedupe, circuit breaker
│   └── askPipeline.ts             # orchestration (classify → retrieve → answer)
│
├── rpc/askStayValid.ts            # the ONLY network endpoint (createServerFn)
│
├── routes/                        # file-based routes
│   ├── __root.tsx                 # shell: header, footer, Toaster, base head tags
│   ├── index.tsx                  # landing page
│   ├── check.tsx                  # intake wizard
│   ├── plan.tsx                   # the dashboard
│   ├── sources.tsx                # research transparency
│   └── privacy.tsx                # privacy statement
│
├── hooks/
│   ├── useStayValid.tsx           # profile + evaluation context, sessionStorage
│   ├── useAskStayValid.tsx        # chat state machine
│   └── use-mobile.tsx
│
├── components/
│   ├── intake/                    # IntakeWizard, Field
│   ├── results/                   # AtAGlance, HorizontalTimeline, FindingCard,
│   │                              # PathwayMap, ActionRoadmap, EvidenceTable,
│   │                              # MeetingKitView (incl. SendToDso)
│   ├── chat/                      # AskStayValid, ChatMessageView, ChatSourceCard
│   ├── shared/                    # AttentionBadge, DateKindBadge, Disclaimer,
│   │                              # InsufficientInfo, SourceLink
│   ├── sources/LegalStatusChip.tsx
│   ├── illustrations/             # hand-drawn student support artwork
│   └── ui/                        # shadcn/ui primitives
│
├── utils/                         # calendarExport (.ics), dateFormatting, print
└── styles.css                     # Tailwind v4 theme + OKLCH design tokens
```

---

## 6. Data layer — the verified corpus

Three JSON files, each stamped with `corpusVersion` and `researchedAsOf`.

**`sources.json` — 18 records.** Each source carries:

- `id`, `title`, `publisher`, `url`, `retrievedAt`
- `legalStatus` — e.g. statute / regulation / agency guidance / policy manual / proposed rule
- `verificationStatus` — how the claim was checked
- `verifiedClaims[]` — the exact statements this source is allowed to support

**`rules.json` — 8 F-1 rules.** Each rule carries a headline, plain-language
explanation, student impact, `attention` level, `confirmationNeeded[]`,
`calculations[]` (the date math the engine must run), `pathways[]`, `findings[]`
conditions, and `sourceIds[]`.

**`candidate-updates.json` — 3 entries.** Proposed or not-yet-effective changes are
deliberately stored *outside* the rule set so they can be shown as "monitor" items
without ever affecting a deadline.

At load, `validateCorpus()` (Zod) checks shape, cross-references every `sourceId`,
and reports problems instead of throwing — a malformed corpus degrades the UI, it
does not crash it. `stripCitationMarkers()` removes inline research markers from
display text while the structured `sourceIds` remain intact for citation UI.

---

## 7. Domain layer — the deterministic engine

### Contract

```ts
evaluateRules(profile: StudentProfile, corpus: Corpus, asOfDate: string): EvaluationResult
```

Pure, synchronous, no I/O. `asOfDate` is injected rather than read from the clock,
so every test and every snapshot is reproducible.

### `EvaluationResult` contains

- `findings: Finding[]` — matched rules with derived dates and attention level
- `derivedDates: DerivedDate[]` — each with `kind` (`hard_deadline`, `window_open`,
  `window_close`, `monitor`, `informational`), label, and originating rule
- `selfReportedGates: SelfReportedGate[]` — conclusions that depend on an unverified
  self-report; shown as gates, never resolved silently
- `insufficientInfo: InsufficientInfoNote[]` with `reason` = `missing_input` or
  `self_reported_gate`
- `missingInputKeys: string[]` — drives the intake to ask exactly what is missing
- corpus provenance (`corpusVersion`, `researchedAsOf`)

### Builders

`buildTimeline`, `buildPathways`, `buildChecklist`, and `buildMeetingKit` are all
pure functions of `EvaluationResult`. They add no policy knowledge — they only
reshape engine output for a specific surface. That separation is why the print kit,
the `.ics` export, and the dashboard can never disagree with each other.

### Date logic

`dateCalculations.ts` holds all day math: 60-day grace period, 30-day pre-start
entry window, 90-day pre-completion OPT filing window, 60-day post-completion
window, STEM extension timing, and duration-of-status vs fixed-date I-94 handling.
It is unit-tested independently of the rules.

---

## 8. Application layer — routes, state, components

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page: what the tool does, what it refuses to do, entry to the check |
| `/check` | Dependency-aware intake wizard; only asks questions the engine needs |
| `/plan` | The dashboard: at-a-glance, timeline, findings, pathways, roadmap, evidence, meeting kit, Ask Stay Valid |
| `/sources` | Every source with legal status + the candidate-updates watchlist |
| `/privacy` | Plain-language privacy statement |

Each leaf route defines its own `head()` with a unique title, description, and
Open Graph / Twitter metadata.

### State

`useStayValid` is a React context holding the profile, the evaluation, and the
`asOfDate`. It persists to `sessionStorage` (not `localStorage`) so closing the tab
clears the session. Re-running the intake resets the chat session too, so an answer
can never be shown against a stale profile.

### Intake

`intakeQuestions.ts` is a registry: each question declares its key, type, options,
and a `dependsOn` predicate. The wizard renders only relevant questions, and the
engine's `missingInputKeys` closes the loop — if a rule needs an input, the intake
asks for it; if it does not, the student never sees it.

### Key result components

- **`AtAGlance`** — the four tiles a student reads first
- **`HorizontalTimeline`** — scrollable, badged by `DateKind`, keyboard reachable
- **`FindingCard`** — headline, explanation, impact, confirmations, citations
- **`PathwayMap`** — branch cards with prerequisites, risks, and required actions
- **`ActionRoadmap`** — confirm-now / prepare / monitor columns
- **`EvidenceTable`** — claim → source → legal status → retrieved date
- **`MeetingKitView`** — print layout plus `SendToDso`: builds a plain-text agenda
  and opens the device mail app or an Outlook web deep link. No email is ever sent
  from the server, and no address is stored.

---

## 9. Ask Stay Valid — the grounded AI layer

The AI layer is **optional and inert by default**. Every other feature works with
it fully disabled.

### Pipeline (`src/server/ai/askPipeline.ts`)

```
question
  │
  ├─ 1. classifyQuestion()      local; blocked categories never reach a provider
  ├─ 2. retrieveVerifiedContext()  local retrieval over the corpus only
  ├─ 3. buildDeterministicAnswer() built FIRST — it is the return value by default
  ├─ 4. primary provider (1 retry, temporary failures only) → fallback provider
  └─ 5. validateGroundedOutput()  schema + grounding check against the sent context
                                  fail → the step-3 answer is returned
```

Because the deterministic answer exists before the first network call, **there is
no failure path where the student sees an error instead of content**. Reasons for
falling back are logged coarsely (`ai_disabled`, `no_key`, `blocked_category`,
`insufficient_evidence`, `circuit_open`, `provider_failed`, `validation_failed`) —
never with question text, profile dates, or answer bodies.

### What may leave the machine

Defined exhaustively by `GroundedChatInput` in `server/ai/provider.ts`:

- the question (truncated to `maxQuestionChars`)
- a **`ShareableProfile`**: I-94 notation, academic stage, OPT stage, travel flag,
  and *booleans* for whether a program-end / EAD-end date exists — never the dates
- the **retrieved rules only**, with dates the engine already derived
- source metadata and `verifiedClaims` for citation
- the last N messages (default 6), not the conversation
- the locally computed safety category

The full corpus, the candidate updates, the full profile, and the full chat history
are never sent.

### Output validation (`outputSchema.ts`)

A model response is accepted only if it parses to the expected shape **and**:

- every `sourceId` was in the supplied set
- every date in the prose appears in the context that was sent
- the safety category matches the local classification (the model cannot upgrade
  itself from "referral" to "answer")

Anything else is dropped in favour of the deterministic answer.

### Providers

| Slot | Default model | Notes |
| --- | --- | --- |
| Primary | `gemini-3.6-flash` | thinking level capped to `low` |
| Fallback | `openai/gpt-oss-20b` (Groq) | `reasoning_effort: "low"` |

Reasoning is capped because unbounded thinking tokens consumed the output budget
and truncated the JSON payload. Budgets: `maxOutputTokens` 1600,
`timeoutMs` 30 000 — both clamped in code so a bad env value cannot drain a free
tier. Fallback fires **only** on temporary errors (timeout, 429, 5xx); a bad or
untrustworthy answer does not earn a second provider call with the same prompt.

### Abuse controls (`rateLimit.ts`)

In-memory, per isolate: per-client request limits, duplicate-question detection via
a non-reversible fingerprint, and a circuit breaker that stops calling a failing
provider. The client IP is used only as a bucket key — never stored, logged, or
attached to a question.

---

## 10. Privacy and security model

- **Storage:** intake answers in `sessionStorage` only. No cookies, no accounts,
  no database, no server-side persistence of anything.
- **Network:** exactly one endpoint (`src/rpc/askStayValid.ts`). With AI disabled
  the browser makes no request at all.
- **Identifier blocking:** `identifierDetection.ts` catches SEVIS IDs, A-numbers,
  SSNs, passport numbers, and similar patterns. Enforced **twice** — in the browser
  before sending, and again on the server, because a request can be made without
  the browser.
- **Server-only enforcement by the build:** every module under `src/server/ai/`
  imports `@tanstack/react-start/server-only`, and the RPC handler imports them
  *dynamically inside the handler*, so an API key reaching the client bundle is a
  build failure rather than a review miss.
- **Key exposure:** `getAiStatus` returns a single boolean — no provider name, no
  model, no key fragment.
- **Input validation:** the request body is Zod-parsed server-side with absolute
  ceilings (4000-char question, 20-message history) independent of any env config.
- **Prompt-injection posture:** retrieval and evaluation are re-run on the server;
  client-supplied context is never trusted into the prompt.

---

## 11. Design system

Tailwind v4 with all colour, gradient, and shadow values defined as **semantic
OKLCH tokens** in `src/styles.css`. Components reference tokens
(`bg-card`, `text-muted-foreground`, `border-warning`) — never hardcoded colours —
so theming and dark mode hold throughout.

Semantic layers include surface/card/muted, plus attention colours mapped to the
domain: `confirm_now`, `prepare`, `monitor`, `information`. Badges
(`AttentionBadge`, `DateKindBadge`, `LegalStatusChip`) are the only places those
colours are interpreted, which keeps urgency visually consistent everywhere.

Accessibility: semantic landmarks and one `<h1>` per page, labelled form controls
with inline error text, visible focus rings, `aria-live` regions for chat status,
reduced-motion honoured, and decorative illustrations marked
`aria-hidden`/described where meaningful.

---

## 12. Testing and verification

Vitest covers the parts where a mistake would be invisible in the UI:

| Suite | Covers |
| --- | --- |
| `dateCalculations.test.ts` | grace periods, windows, boundary days, leap years |
| `evaluateRules.test.ts` | rule matching, derived dates, attention levels |
| `scenarioBehaviour.test.ts` | end-to-end expectations for each canonical profile |
| `selfReportedGates.test.ts` | the engine never adjudicates a self-reported fact |
| `dataAdapters.test.ts` | corpus load, validation, citation stripping, lookups |
| `safety.test.ts` | classification and the AI block list |
| `identifierDetection.test.ts` | PII patterns and false-positive guards |
| `retrieveVerifiedContext.test.ts` | retrieval relevance and context budget |
| `buildDeterministicAnswer.test.ts` | AI-free answers stay grounded and cited |
| `askPipeline.test.ts` | retry, fallback eligibility, validation rejection paths |
| `rateLimit.test.ts` | limits, dedupe, circuit breaker |
| `calendarExport.test.ts` | `.ics` structure and escaping |

Release gate:

```bash
npm run verify   # typecheck → lint → test → production build
```

Live providers were additionally smoke-tested end-to-end: one grounded answer per
provider with `origin: "gemini"` and `origin: "groq"`, citations resolved, no
fallback triggered.

---

## 13. Configuration reference

All variables are optional. See `.env.example` for the annotated version.

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_CHAT_ENABLED` | `true` | Set to exactly `false` to disable the AI layer |
| `AI_PROVIDER` | `gemini` | Primary provider |
| `AI_FALLBACK_PROVIDER` | `groq` | Used only on temporary primary failures |
| `GEMINI_API_KEY` | — | Without it the Gemini slot is inert |
| `GEMINI_MODEL` | `gemini-3.6-flash` | |
| `GROQ_API_KEY` | — | Without it the Groq slot is inert |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | |
| `AI_MAX_QUESTION_CHARS` | `1200` | Clamped 40–4000 |
| `AI_MAX_CONTEXT_CHARS` | `12000` | Clamped 500–40 000; whole rules dropped to fit |
| `AI_MAX_HISTORY_MESSAGES` | `6` | Clamped 0–20 |
| `AI_MAX_OUTPUT_TOKENS` | `1600` | Clamped 100–4000 |
| `AI_TIMEOUT_MS` | `30000` | Clamped 1000–60 000 |

With no keys set, the app is fully functional and fully offline: the timeline,
checkpoints, pathways, checklist, calendar export, and DSO meeting kit never call a
provider under **any** configuration.

---

## 14. Deployment

Built for an edge runtime (Cloudflare Workers with `nodejs_compat`). Everything is
bundled at build time — there is no runtime module resolution, and no Node-only
package (`sharp`, `child_process`, native addons) may be introduced into a server
function.

Secrets are supplied as environment variables / worker secrets, read **inside**
handlers (never at module scope) so injection timing is correct.

Live: **https://stay-valid.lovable.app**

---

## 15. Extending the project

**Add a rule.** Add its sources to `sources.json` with `verifiedClaims`, add the
rule to `rules.json` with `calculations`, `pathways`, and `sourceIds`, then add a
case to `evaluateRules.test.ts` and a scenario expectation. No component changes
are needed — every surface derives from the engine.

**Add an intake question.** Register it in `intakeQuestions.ts` with its
`dependsOn` predicate and add the field to `StudentProfile`; the wizard and the
`missingInputKeys` loop pick it up automatically.

**Add an AI provider.** Implement `AiChatProvider` in `src/server/ai/`, add the key
and model to `config.ts`, and register it in `resolveProvider()`. The pipeline,
validation, breaker, and fallback logic need no changes.

**Non-negotiables when changing this codebase.** Keep the domain layer pure and
free of React. Keep the deterministic answer built before any provider call. Never
widen `GroundedChatInput`. Never remove the double identifier check. Never let a
rule assertion ship without a resolving `sourceId`.
