# Handoff

For whoever picks this up next — human, Codex, or Cursor.

---

## 1. Run it

```bash
npm install
npm run dev
```

`http://localhost:8080`. No configuration needed: AI is off by default and
everything works without it.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build (Cloudflare Worker via Nitro) |
| `npm run preview` | Serve the production build |
| `npm run test` | Vitest, once |
| `npm run test:watch` | Vitest, watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier |
| `npm run verify` | typecheck → lint → test → build |

`npm run verify` is what CI should run.

### On lockfiles

The canonical lockfile is `bun.lock` (see `bunfig.toml`). `package-lock.json` is
gitignored so an npm-based contributor cannot accidentally make it compete. If
you have Bun, use it.

### On line endings

`.gitattributes` forces LF. Without it, a Windows checkout with
`core.autocrlf=true` produces thousands of spurious Prettier errors. If you see
`Delete ␍` from lint, your checkout predates that file:

```bash
git config core.autocrlf false && git rm --cached -r . -q && git reset --hard
```

---

## 2. Enabling the optional AI

**Nothing below is required.** The app is fully functional with AI off.

### Local development

Create `.env` (Vite dev) or `.dev.vars` (wrangler). Both are gitignored. Copy
`.env.example` and fill in:

```env
AI_CHAT_ENABLED=true
AI_PROVIDER=gemini
AI_FALLBACK_PROVIDER=groq
GEMINI_API_KEY=your-key-here
GROQ_API_KEY=your-key-here
```

Keys: [Gemini](https://aistudio.google.com/apikey) ·
[Groq](https://console.groq.com/keys). Both have free tiers; every quota guard in
this codebase exists to keep you inside them.

### Production on Cloudflare

Secrets go in Wrangler, never in a file:

```bash
npx wrangler secret put GEMINI_API_KEY
```

```bash
npx wrangler secret put GROQ_API_KEY
```

Non-secret values (`AI_CHAT_ENABLED`, `AI_PROVIDER`, the caps) can go in `[vars]`
in `wrangler.toml` or the dashboard.

### If you deploy on Lovable

Confirm its hosting runs the server output and supports server-side secrets
before enabling AI. **If it cannot keep a secret server-side, leave
`AI_CHAT_ENABLED=false`.** The deterministic natural-language search remains
fully functional, and that is a supported configuration rather than a
degradation. Never move a provider call into the browser.

### Full variable list

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_CHAT_ENABLED` | `false` | Master switch; must be exactly `true` |
| `AI_PROVIDER` | `gemini` | Primary |
| `AI_FALLBACK_PROVIDER` | none | Used only on timeout/429/5xx |
| `GEMINI_API_KEY` | — | Secret |
| `GEMINI_MODEL` | `gemini-2.0-flash` | |
| `GROQ_API_KEY` | — | Secret |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | |
| `AI_MAX_QUESTION_CHARS` | `1200` | |
| `AI_MAX_CONTEXT_CHARS` | `12000` | |
| `AI_MAX_HISTORY_MESSAGES` | `6` | |
| `AI_MAX_OUTPUT_TOKENS` | `600` | |
| `AI_TIMEOUT_MS` | `15000` | |

All numeric values are clamped in code, so a typo cannot empty a free tier.

---

## 3. Things to know before changing anything

### The engine must stay pure

`evaluateRules` never reads the clock. `asOfDate` is captured once per session
and threaded through. If you find yourself reaching for `new Date()` inside
`src/domain/`, that is the signal to stop.

### AI may never decide anything

The layer rephrases. It cannot create a rule, compute a date, or determine
status. `validateGroundedOutput` is what actually enforces this — not the system
prompt. If you loosen the validator, you have loosened the product's core
promise. Read `docs/ARCHITECTURE.md` §6.4 first.

### `src/server/**` cannot be imported from the client

The framework's import-protection plugin denies it, including dynamic imports.
That is why `createServerFn` lives in `src/rpc/`. If the build fails with
`[import-protection] Import denied in client environment`, the guard is working —
move the boundary, do not disable the plugin.

### Do not edit `routeTree.gen.ts`

Generated.

### Do not "fix" the corpus

`rules.json` is the legal source of truth. If a date looks wrong, record it in
`docs/POLICY_AUDIT.md` — do not change it without an authoritative primary
source.

---

## 4. Highest-value next work

Roughly in order.

1. **Component tests for the chat panel.** The largest coverage gap. Nothing
   currently asserts Enter-vs-Shift+Enter, that the disclosure actually gates
   the first AI send, that an identifier block prevents the message entering the
   conversation, or that "Clear my information" empties it. React Testing Library
   over `AskStayValid` would cover all four.

2. **Work through `docs/POLICY_AUDIT.md`.** Item §2 is the structural one: the
   2030-11-14 transition cap and several other thresholds are literals in
   `CALCULATORS` that merely mirror prose in `rules.json`. Nothing validates that
   the two agree, so editing the corpus alone would silently fail to change
   behaviour. Moving thresholds into `rules.json` as structured fields would make
   the corpus genuinely the single source of truth.

3. **Accessibility verification.** No automated axe run, no real screen-reader
   pass. The markup was written carefully but has not been tested with a
   screen reader on real hardware.

4. **Rate limiting is per-isolate.** Module memory on Cloudflare Workers means
   best-effort, not global. Adequate for stopping one tab from draining a quota;
   inadequate against deliberate abuse. Durable Objects or KV would fix it, at
   the cost of the "no database" constraint.

5. **Split `useStayValid.tsx`.** It exports both a component
   (`StayValidProvider`) and non-components (the hook, the state type), which is
   what the `react-refresh/only-export-components` warning is about. The
   practical cost is real: editing that file during `npm run dev` replaces the
   module and creates a fresh context object while the mounted provider still
   holds the old one, so every consumer throws
   `useStayValid must be used inside <StayValidProvider>` until you hard-reload.
   Observed during this work; harmless in production, irritating in development.
   Moving the context and hook into their own module fixes it.

6. **Small cleanups.** `safeJsonParse` is exported from `geminiProvider` and
   imported by `groqProvider` — it belongs in a shared module. The corpus loads
   eagerly at module scope, putting ~101 KB in the initial client bundle;
   splitting rules from sources would help first paint.

7. **Retrieval scaling.** A linear scan over 8 rules and 18 sources is
   instant. At a few hundred rules it will need an inverted index. The interface
   would not have to change.

---

## 5. Test map

258 tests across 12 files. All provider calls are mocked; **no test consumes API
credits.**

| File | Covers |
| --- | --- |
| `domain/evaluateRules.test.ts` | Determinism, gating, insufficient info, corpus boundary tests |
| `domain/selfReportedGates.test.ts` | Self-reported status never becomes a determination |
| `domain/dateCalculations.test.ts` | Date boundaries, leap years, DST independence |
| `domain/scenarioBehaviour.test.ts` | Sept 15 gate, D/S vs fixed-date, OPT/STEM, travel, candidate updates |
| `domain/chat/retrieveVerifiedContext.test.ts` | Relevance, candidate exclusion, caps, determinism |
| `domain/chat/safety.test.ts` | Every safety category |
| `domain/chat/identifierDetection.test.ts` | Detection and — equally important — non-detection |
| `domain/chat/buildDeterministicAnswer.test.ts` | Answers with no AI; no legal conclusions |
| `server/ai/askPipeline.test.ts` | Provider failures, fallback rules, validation, what gets transmitted |
| `server/ai/rateLimit.test.ts` | Window, duplicates, breaker, backoff |
| `domain/dataAdapters.test.ts` | Research markers never reach displayable text |
| `utils/calendarExport.test.ts` | RFC 5545 correctness, provenance in every event |

---

## 6. Before this goes near a real student

**The corpus has not been legally verified.** It is self-declared
`research_draft_requires_human_review`, and every rule sets
`humanReviewRequired: true`. This work was an engineering audit — it verified
that the product handles the corpus honestly, not that the corpus is correct.

A qualified immigration professional needs to sign off `rules.json` before the
app is presented to students as usable guidance.
