# Stay Valid

> Turn F-1 immigration policy into dated checkpoints, clear next steps, and a
> printable DSO meeting kit — with every item traced to an official source.
>
> Built for the **Stellic Pathfinders Challenge**.

**Educational preparation tool. Not legal advice.** Stay Valid never determines
your immigration status and never states eligibility.

---

## What it does

An F-1 student answers a handful of non-identifying questions — what their I-94
says, their I-20 dates, where they are in their program, whether they are
travelling. Stay Valid runs a deterministic rules engine over a versioned
research corpus and produces:

- a **timeline** where every date says where it came from;
- **findings** with an attention level and the reason they appeared;
- **pathways** — topics to raise, never eligibility claims;
- a prioritised **checklist**;
- a **calendar export** (`.ics`);
- a printable **DSO meeting kit**;
- **Ask Stay Valid** — a question box that answers in plain language, from the
  same verified sources.

It asks for no name, no SEVIS ID, no passport number, no uploads, and keeps
nothing after you close the tab.

---

## Core evaluation is deterministic and works without AI

Optional server-side AI can explain verified results but cannot create or modify
rules.

That distinction is the whole design:

| | Deterministic engine | Optional AI layer |
| --- | --- | --- |
| Decides which rules apply | ✅ | ❌ |
| Calculates dates and deadlines | ✅ | ❌ |
| Determines status or eligibility | ❌ *(by design)* | ❌ |
| Rephrases verified findings | — | ✅ |
| Runs with no API key | ✅ | n/a |
| Can be switched off entirely | — | ✅ *(default)* |

With AI disabled — the default — asking a question makes **no network request at
all**. Classification, retrieval and answer construction all happen in your
browser. The timeline, checkpoints, pathways, checklist, calendar export and
meeting kit never involve an AI provider under **any** configuration.

---

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open `http://localhost:8080`. No configuration required.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (Cloudflare Worker via Nitro) |
| `npm run preview` | Serve the production build |
| `npm run test` | Vitest, once |
| `npm run test:watch` | Vitest, watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier |
| `npm run verify` | typecheck → lint → test → build |

The canonical lockfile is `bun.lock`; `package-lock.json` is gitignored so it
cannot compete. `.gitattributes` forces LF line endings — without it a Windows
checkout produces thousands of spurious Prettier errors.

---

## How it works

### The corpus is the source of truth

Three JSON files under `src/data/`, never edited by code:

| File | Role |
| --- | --- |
| `sources.json` | Official documents — Federal Register, USCIS, eCFR, DHS, university guidance — with tier, legal status, verified claims, and when each was last checked |
| `rules.json` | Rules with predicates, date formulas, findings, pathways, and the source IDs backing them |
| `candidate-updates.json` | Unverified developments (litigation, rulemaking). **Watchlist only — these can never activate a rule.** |

Adapters normalise them once at load. Validation reports whether they are usable
and never repairs them: when data is unavailable the UI says so rather than
inventing content.

### The engine is a pure function

```ts
evaluateRules(profile, corpus, asOfDate) => EvaluationResult
```

The clock is never read inside it — `asOfDate` is captured once per session and
threaded through. The same profile, corpus and date always produce byte-identical
output, which is asserted by test.

Non-negotiables it enforces:

- Only verified rules generate findings; candidate updates never do.
- Missing information produces an explicit insufficient-information state, never
  a guess.
- Publication is not proof a rule is in force — scheduled effective dates are
  marked *needs confirmation*, not *official*.
- A rule that is not yet in force can never be shown as "confirm now", and can
  never emit an official deadline.
- Visa expiry, I-20 program end, EAD expiry and I-94 admit-until are four
  different dates and stay four different dates.

### Every date says what kind of date it is

| Badge | Meaning |
| --- | --- |
| **Official date** | Stated or computed from a government source that is in force |
| **From your document** | You typed it off your own paperwork |
| **Stay Valid reminder** | A preparation prompt — *not* a government deadline |
| **Needs confirmation** | Depends on a rule not yet in force, or one that is uncertain |

This survives into the `.ics` export, so a checkpoint you read months later out
of context still tells you what it is.

### Your own answer is never treated as a determination

Asked *"has anyone told you there is a problem with your F-1 status?"*, a student
can honestly answer **"I'm not sure"** — and should be able to.

Earlier, that answer silently removed the most important rule for D/S students:
no finding, no note, nothing on the page. Silence there reads as *"this does not
apply to you"*, which is exactly the determination the product forbids itself
from making.

Now:

- answer "no problem that I know of" → the rule appears, **labelled as resting on
  your own answer**, with the caveat that only a DSO can confirm it;
- any other answer → an explicit *"only your DSO can answer this"* note, so you
  can see the topic was held back rather than ruled out.

---

## Ask Stay Valid

A free-text question box on your results page. Type a question in your own
words — *"how could the September 15 rule affect someone already admitted for
D/S?"*, *"what should I discuss with my DSO before traveling?"*, *"why is my
program end date important?"*

The timeline stays the centre of the product. This explains what you have just
read; it does not replace it.

**How a question is handled:**

```
1. Classified locally      — some questions get reviewed wording, never a model
2. Identifiers detected    — a message that looks like it holds one is not sent
3. Retrieved locally       — verified rules and sources only, capped and ranked
4. Answered deterministically — quoting the corpus's own approved wording
5. Optionally rephrased    — only if AI is on, you have agreed, and it can help
```

Step 4 completes **before** any network call, so every failure path is already
covered and you are never shown an error instead of an answer.

**Questions that never reach a model, in any configuration:**

| You ask | You get |
| --- | --- |
| "Am I still in status?" | A refusal to determine status, and a pointer to your DSO |
| "Should I leave the country?" | A decline to advise, and a pointer to an attorney |
| "I was detained at the airport" | Immediate escalation to your DSO and an attorney |
| "How do I get a green card?" | An honest out-of-scope answer |
| Something the corpus does not cover | An explicit insufficient-evidence answer |

**Also:** free-text input with Enter to send and Shift+Enter for a newline;
loading, retry and quota-unavailable states; clear-conversation; source cards
showing legal status and last-checked date; suggested follow-ups drawn from the
corpus's own DSO questions; an "ask your DSO" escalation on every answer; and a
standing warning never to type a passport, SEVIS, visa, A-number or receipt
number. Every answer states its origin — *quoted from verified sources* or
*explained by AI from verified sources* — so you always know which you have.

---

## Optional AI (off by default)

Provider order: **Gemini → Groq → deterministic.**

Enable it by copying `.env.example` to `.env` (or `.dev.vars` for wrangler) and
setting `AI_CHAT_ENABLED=true` with at least one key. Both files are gitignored.

For production on Cloudflare:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Full variable reference and deployment steps: [`docs/HANDOFF.md`](docs/HANDOFF.md).

### What is sent, and what is not

**Sent:** your question; a few non-identifying profile fields (I-94 notation,
academic stage, OPT stage, travel planned, and *whether* a program-end or EAD
date exists — **not the dates**); the small set of matching verified rules with
dates the engine already calculated; limited source metadata; up to six recent
messages.

**Never sent:** the full corpus; any candidate update; any identifier; any API
key. Keys live only on the server — verified against the built output, the client
bundle contains zero occurrences of either key name, either provider hostname,
the auth headers, or the system prompt.

### The AI cannot decide anything

Every provider answer is validated *after* it returns, because structured output
guarantees formatting and not truthfulness. An answer is **discarded** and
replaced with the plain sourced version if it:

- cites a source ID that was not supplied;
- states a date that was not in the supplied context (a fabricated deadline);
- asserts status, eligibility, legality, or a predicted outcome;
- advises you to leave, stay, or re-enter the United States.

It also cannot lower the "confirm with your DSO" flag, and cannot reclassify its
way out of a blocked category.

### Quota protection

Capped question length, context, history and output; request timeout; at most one
retry; exponential backoff with jitter; a circuit breaker; duplicate-submission
suppression; per-client rate limiting. The fallback provider is used **only** on a
temporary failure — never on a safety refusal, which would turn it into a way to
shop for a permissive model. No AI call happens on page load.

---

## Privacy

- No account, no login, no uploads.
- No name, date of birth, SEVIS ID, passport, visa, A-number or receipt number is
  ever requested — and the chat refuses to send a message that looks like it
  contains one.
- Your evaluation runs in your browser. Nothing is written to `localStorage`,
  cookies, or a server.
- "Clear my information" erases your answers **and** the chat conversation
  immediately. So does closing the tab.
- With AI enabled, you see a disclosure and must acknowledge it before the first
  AI-assisted answer. The provider processes that request under its own policy.
- Stay Valid does not intentionally store conversations, and does not log
  question text or profile dates.

Full detail on the in-app privacy page and in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Project layout

```
src/
├── data/            research corpus (read-only source of truth)
├── domain/          pure logic — no React, no I/O, no clock
│   └── chat/        question normalisation, retrieval, safety, local answers
├── rpc/             the server-function boundary (client-callable stub)
├── server/ai/       provider abstraction, prompts, validation (server-only)
├── components/      intake, results, chat, shared, ui
├── hooks/           in-memory session and conversation state
├── routes/          TanStack Start file-based routes
└── utils/           calendar export, date formatting, print
docs/
├── ARCHITECTURE.md    how it fits together
├── CLAUDE_AUDIT.md    audit findings, bugs fixed, remaining work
├── POLICY_AUDIT.md    corpus concerns for a qualified reviewer
└── HANDOFF.md         setup, deployment, next steps
```

`src/server/**` cannot be imported from client code — the framework's
import-protection plugin denies it. That is why the server function lives in
`src/rpc/` and the implementation in `src/server/ai/`.

---

## Stack

React 19 · TypeScript 5.8 (strict) · TanStack Start + Router · Vite · Tailwind
CSS v4 · Radix UI · Zod · Vitest · Cloudflare Worker via Nitro.

The AI layer added **no new runtime dependencies** — providers are called with
`fetch`.

---

## Tests

```bash
npm run test
```

258 tests across 12 files. Every provider call is mocked; **no test consumes API
credits.**

Coverage includes determinism, activation gating and date boundaries; leap years
and DST independence; D/S versus fixed-date admission; OPT and STEM OPT; travel;
candidate updates never activating a rule; retrieval relevance and candidate
exclusion; every safety category; identifier detection *and* non-detection
("60 days" and "$350 SEVIS fee" must not trip it); provider timeouts, 429s, 5xx,
malformed output, invented source IDs and fabricated deadlines; correct and
incorrect fallback triggers; RFC 5545 calendar correctness; and assertions that
no answer — deterministic or AI — ever states a legal conclusion.

---

## Status

The research corpus is self-declared
`research_draft_requires_human_review`, and every rule carries
`humanReviewRequired: true`. The engineering work verifies that the product
handles the corpus *honestly* — it does not verify that the corpus is *correct*.

**A qualified immigration professional must review `rules.json` before this is
presented to students as usable guidance.** Open questions are itemised in
[`docs/POLICY_AUDIT.md`](docs/POLICY_AUDIT.md).

---

## Disclaimer

Stay Valid is an educational planning tool, not legal advice. It does not
determine immigration status and is not a substitute for a Designated School
Official or a qualified immigration attorney. Always verify deadlines and
requirements with your DSO and the official government sources it links to.
