# Stay Valid — Project Documentation

> **Status Compass for F-1 international students.**
> Turn immigration policy into dated timelines, attention-based checkpoints, and a printable DSO meeting kit.
>
> Built for the **Stellic Pathfinders Challenge**.

---

## 1. What this project is

**Stay Valid** is a deterministic, client-side web application that helps F-1 international students understand how current U.S. immigration rules map to their personal situation. It does **not** give legal advice, store data, or use AI. Instead it:

1. Reads a curated, versioned research corpus (`sources.json`, `rules.json`, `candidate-updates.json`).
2. Collects non-identifying facts through a privacy-first questionnaire.
3. Runs a pure-function rules engine to produce:
   - a chronological **timeline**,
   - **attention-based findings**,
   - relevant **pathways / next steps**,
   - a **preparation checklist**, and
   - a **printable DSO meeting kit**.

All outputs are traced back to official sources. Every legal deadline is labelled as official, document-based, a Stay Valid reminder, or a confirmation-needed item.

---

## 2. Technology stack

| Layer | Choice |
|-------|--------|
| Framework | [TanStack Start](https://tanstack.com/start) v1 (React 19 + Vite 7 + file-based routing) |
| Language | TypeScript 5.8 (strict mode) |
| Styling | Tailwind CSS v4 with native CSS `@theme` tokens |
| UI primitives | Radix UI (shadcn-style components) |
| Icons | Lucide React |
| State | React Context + `useMemo` (in-memory only) |
| Forms | React Hook Form + Zod |
| Testing | Vitest |
| Build target | Cloudflare Worker (edge) via Nitro |

**No backend, no database, no runtime AI, no external API calls.** All data lives in the bundled JSON files and React state.

---

## 3. Project structure

```text
├── public/                        # Static assets (favicon, robots.txt)
├── src/
│   ├── components/
│   │   ├── intake/                # Questionnaire components
│   │   │   ├── Field.tsx          # Reusable date/radio/checkbox fields
│   │   │   └── IntakeWizard.tsx   # Multi-step intake form
│   │   ├── layout/                # Site chrome
│   │   │   ├── SiteHeader.tsx
│   │   │   └── SiteFooter.tsx
│   │   ├── results/               # Plan / results page widgets
│   │   │   ├── FindingCard.tsx
│   │   │   ├── MeetingKitView.tsx
│   │   │   ├── PathwayList.tsx
│   │   │   └── TimelineView.tsx
│   │   └── shared/                # Reusable status/source components
│   │       ├── AttentionBadge.tsx
│   │       ├── DateKindBadge.tsx
│   │       ├── Disclaimer.tsx
│   │       ├── InsufficientInfo.tsx
│   │       ├── SourceLink.tsx
│   │       └── VerificationChip.tsx
│   ├── data/                      # Research corpus (source of truth)
│   │   ├── candidate-updates.json
│   │   ├── rules.json
│   │   └── sources.json
│   ├── domain/                    # Pure business logic — no React, no I/O
│   │   ├── buildChecklist.ts
│   │   ├── buildMeetingKit.ts
│   │   ├── buildPathways.ts
│   │   ├── buildTimeline.ts
│   │   ├── dataAdapters.ts        # JSON → typed corpus adapters
│   │   ├── dataValidation.ts      # Defensive corpus validation
│   │   ├── dateCalculations.ts    # ISO-8601 date math
│   │   ├── evaluateRules.ts       # Core deterministic rules engine
│   │   ├── evaluateRules.test.ts  # Engine tests
│   │   ├── scenarios.ts           # 4 demo personas
│   │   └── types.ts               # All domain types
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── useStayValid.tsx       # In-memory session context
│   ├── lib/
│   │   ├── error-capture.ts
│   │   ├── error-page.ts
│   │   ├── lovable-error-reporting.ts
│   │   └── utils.ts               # cn() and helpers
│   ├── routes/                    # TanStack file-based routes
│   │   ├── __root.tsx             # Root layout + provider
│   │   ├── index.tsx              # Home / landing
│   │   ├── check.tsx              # Questionnaire route
│   │   ├── plan.tsx               # Results dashboard
│   │   ├── sources.tsx            # Research transparency page
│   │   └── privacy.tsx            # Privacy principles
│   ├── utils/
│   │   ├── calendarExport.ts      # .ics calendar export
│   │   ├── dateFormatting.ts      # Display formatting
│   │   └── print.ts               # Browser print helper
│   ├── router.tsx                 # TanStack router factory
│   ├── server.ts                  # SSR error wrapper
│   ├── start.ts                   # App entry
│   ├── routeTree.gen.ts           # Auto-generated route tree
│   └── styles.css                 # Design tokens + Tailwind theme
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md                      # This file
```

---

## 4. Data model

### 4.1 Research corpus (`Corpus`)

Three JSON files are loaded once at startup and treated as read-only:

- **`sources.json`** → `SourceCorpus`
  - `corpusVersion`, `researchedAsOf`
  - `sources[]`: official documents (Federal Register, USCIS, DHS, university guidance) with tier, legal status, URL, dates, claims, conflicts.

- **`rules.json`** → `RuleCorpus`
  - `corpusVersion`, `researchedAsOf`, `ruleSetStatus`
  - `rules[]`: individual rules with:
    - `classifications` (e.g. `["F-1"]`)
    - `activeFrom` / `activeUntil` / `doNotActivateBefore`
    - `appliesWhen.all/any/not` — named predicate keys
    - `requiredInputs` — profile fields needed before the rule can run
    - `calculation` — formula metadata and whether it is a legal deadline
    - `finding` — attention, headline, explanation, actions, DSO questions
    - `possiblePathways` — optional next-step topics
    - `sourceIds` — links back to sources
    - `legalStatus`, `uncertainty`, `humanReviewRequired`

- **`candidate-updates.json`** → `CandidateCorpus`
  - `updates[]`: unverified developments (litigation, rulemaking, etc.) that may affect matched rules but **never activate** a rule.

### 4.2 Student profile (`StudentProfile`)

Deliberately minimal and non-identifying. No name, DOB, passport, visa, SEVIS ID, A-number, or receipt number.

| Field | Type | Meaning |
|-------|------|---------|
| `classification` | `"F-1"` | Visa classification |
| `i94Notation` | `"ds" \| "fixed_date" \| "unknown"` | What the I-94 admit-until notation says |
| `i94AdmitUntilDate` | ISO date \| null | Fixed date printed on I-94 |
| `mostRecentEntryDate` | ISO date \| null | Last U.S. entry |
| `presentInUS` | yes/no/unsure | In the U.S. |
| `maintainingStatus` | yes/no/unsure | Maintaining F-1 status |
| `i20ProgramStartDate` | ISO date \| null | I-20 program start |
| `i20ProgramEndDate` | ISO date \| null | I-20 program end |
| `academicStage` | enum | not_started / in_progress / final_term / completed |
| `optStage` | enum | none / preparing / applied / post_completion_opt / stem_opt |
| `eadStartDate` / `eadEndDate` | ISO date \| null | OPT/STEM OPT EAD dates |
| `dsoOptRecommendationDate` | ISO date \| null | When DSO entered OPT recommendation |
| `plannedTravel` | boolean | Planning international travel |
| `plannedDepartureDate` | ISO date \| null | Planned departure |
| `expectedReentryDate` | ISO date \| null | Expected return |
| `pendingApplication` | boolean | Any pending EOS/OPT/etc. application |
| `goals` | `Goal[]` | What the student wants help with |

### 4.3 Engine output (`EvaluationResult`)

```ts
interface EvaluationResult {
  asOfDate: string;                 // date the evaluation was run
  corpusVersion: string;
  researchedAsOf: string;
  ruleSetStatus: string;
  findings: Finding[];              // matched rules with attention + dates
  insufficient: InsufficientInfoNote[]; // rules blocked by missing inputs
  relatedCandidateUpdates: CandidateUpdate[]; // watchlist items for matched rules
  evaluatedRuleIds: string[];
  skippedRuleIds: string[];
}
```

Derived views:

- `TimelineItem[]` — unified chronological list of dates with status (past/today/future).
- `PathwayCard[]` — deduplicated next-step topics across findings.
- `ChecklistAction[]` — sorted actionable items.
- `MeetingKit` — printable one-page summary for a DSO appointment.

---

## 5. The rules engine

The engine is in `src/domain/evaluateRules.ts`. It is a **pure function**:

```ts
evaluateRules(profile, corpus, asOfDate) => EvaluationResult
```

### 5.1 Activation model

For each rule the engine performs these checks in order:

1. **Classification filter** — skip if the rule's `classifications` do not include the student's classification.
2. **Active window** — skip if `activeUntil` has passed relative to `asOfDate`.
3. **Predicates** — evaluate `appliesWhen.all`, `appliesWhen.any`, and `appliesWhen.not` against the profile.
4. **Required inputs** — if any required profile value is missing/unknown, emit an `InsufficientInfoNote` and skip.
5. **Gate / legal status** — determine whether the rule is `pendingEffective`:
   - `doNotActivateBefore` not yet reached
   - `activeFrom` not yet reached
   - `legalStatus` is `published_pending_effective`, `proposed`, `delayed`, `stayed`, `enjoined`, `terminated`, `superseded`, or `status_uncertain`
6. **Date calculation** — only compute deadlines when the rule is in force and `calculation.isLegalDeadline` is true. Otherwise dates become `needs_confirmation`.

### 5.2 Predicates

Named predicate keys live in `PREDICATES`. Examples:

- `studentClassificationIsF1`
- `i94NotationIsDS`
- `presentInUSOnEffectiveDate`
- `programCompleted`
- `plannedInternationalTravel`
- `expectedReentryOnOrAfterEffectiveDate`

`"unsure"` answers never satisfy a predicate.

### 5.3 Calculators

Each rule with date math has a matching calculator keyed by `rule.id`:

| Rule ID | What it computes |
|---------|------------------|
| `rule-f1-program-end-ds-grace-period` | 60-day grace period after I-20 program end |
| `rule-f1-transition-existing-ds-student` | D/S transition authorized stay capped at 2030-11-14 |
| `rule-f1-fixed-admission-after-effective-date` | Fixed-period admit-until basis + 30-day departure window |
| `rule-f1-opt-filing-window` | 90-day pre-completion / 60-day post-completion I-765 windows |
| `rule-f1-travel-readmission-fixed-period` | Reentry review marker |
| `rule-f1-unlawful-presence-fixed-aud` | I-94 admit-until date from student's document |

### 5.4 Attention levels

The only status vocabulary in the UI:

| Attention | Meaning | Color token |
|-----------|---------|-------------|
| `confirm_now` | Needs immediate verification or action | `--attn-confirm` (red) |
| `prepare` | Plan ahead | `--attn-prepare` (amber) |
| `monitor` | Watch for changes | `--attn-monitor` (blue) |
| `information` | Context / background | `--attn-info` (slate) |

Rules that are pending-effective have their attention downgraded so they can never show `confirm_now`.

---

## 6. UI architecture

### 6.1 State management

`src/hooks/useStayValid.tsx` provides a single React Context:

- `profile` — current answers
- `asOfDate` — captured once per session
- `corpus` / `validation` — loaded corpus
- `evaluation`, `timeline`, `pathways`, `actions`, `meetingKit` — memoized derived values
- `updateProfile`, `loadScenario`, `clearAll`

**Privacy guarantee:** nothing is written to `localStorage`, cookies, or any server. Refreshing the page resets the form.

### 6.2 Routes

| File | URL | Purpose |
|------|-----|---------|
| `index.tsx` | `/` | Landing page with scenario cards and how-it-works |
| `check.tsx` | `/check` | Multi-step intake questionnaire |
| `plan.tsx` | `/plan` | Results dashboard (timeline, findings, pathways, watchlist, meeting kit) |
| `sources.tsx` | `/sources` | Full research transparency: sources + candidate updates |
| `privacy.tsx` | `/privacy` | Privacy-by-design principles |

### 6.3 Key components

- **`IntakeWizard.tsx`** — 4-step form with scenario quick-starts, date validation, and step navigation.
- **`Field.tsx`** — `DateField`, `RadioGroupField`, `CheckboxGroupField` with accessible labels.
- **`TimelineView.tsx`** — chronological list with `.ics` export per item.
- **`FindingCard.tsx`** — expandable rule result with official rationale, actions, DSO questions.
- **`PathwayList.tsx`** — grouped next-step topics.
- **`MeetingKitView.tsx`** — print-optimized one-page summary.
- **`AttentionBadge.tsx` / `DateKindBadge.tsx`** — status indicators.
- **`Disclaimer.tsx`** — legal disclaimers and educational notice.

---

## 7. Design system

Defined in `src/styles.css` using Tailwind v4 `@theme` tokens.

### 7.1 Color tokens

- `--background`: warm paper
- `--foreground`: midnight ink
- `--primary`: ink
- `--accent`: teal
- `--ink` / `--ink-foreground`: hero/dark sections
- `--teal` / `--teal-soft`: primary accent
- `--amber` / `--amber-soft`: reserved for `prepare` attention

### 7.2 Attention tokens

```css
--attn-confirm: oklch(0.5 0.145 22);
--attn-prepare: oklch(0.53 0.115 66);
--attn-monitor: oklch(0.47 0.075 216);
--attn-info:    oklch(0.42 0.028 258);
```

### 7.3 Typography

- Sans: **Source Sans 3**
- Serif: **Newsreader** (used for headlines)
- Loaded via `<link>` in `src/routes/__root.tsx`.

### 7.4 Shadows

- `--shadow-card`: subtle card shadow
- `--shadow-lift`: hover/focus lift shadow

---

## 8. How to run locally

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

The app runs at `http://localhost:8080` by default.

### Available scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npx vitest run` | Run tests |

---

## 9. Testing

Tests live in `src/domain/evaluateRules.test.ts` and run with **Vitest**.

Coverage includes:

- Determinism: identical inputs → identical output
- Activation gating: rules not yet in force cannot produce legal deadlines
- Missing inputs: produce `InsufficientInfoNote`, never a guess
- Candidate updates: never activate a rule
- Boundary tests defined in the corpus
- Date math correctness

```bash
npx vitest run
```

---

## 10. Privacy & data handling

- **No PII collected.** The form explicitly avoids name, DOB, passport, visa foil number, SEVIS ID, A-number, and receipt numbers.
- **No persistence.** All answers live in React state. Refreshing clears them.
- **No backend calls.** The corpus is bundled JSON; no network requests are made for evaluation.
- **No AI at runtime.** Outputs are deterministic rule applications.

See `src/routes/privacy.tsx` for the full privacy statement.

---

## 11. How to extend

### Add a new rule

1. Add the rule to `src/data/rules.json`.
2. If it needs new predicates, add them to `PREDICATES` in `src/domain/evaluateRules.ts`.
3. If it computes dates, add a calculator to `CALCULATORS` keyed by the new `rule.id`.
4. Add required-input resolvers to `REQUIRED_INPUT_RESOLVERS` if needed.
5. Add boundary tests to the rule JSON and/or `evaluateRules.test.ts`.

### Add a new source

1. Add the source to `src/data/sources.json`.
2. Reference its `id` in the `sourceIds` of relevant rules.

### Add a new page

1. Create a file under `src/routes/`.
2. Export `Route` using `createFileRoute('/path')`.
3. Add a `head()` with title, description, og tags.
4. The route will be picked up automatically by TanStack's file-based router.

### Add a new demo scenario

1. Open `src/domain/scenarios.ts`.
2. Add a `Scenario` object with `id`, `name`, `summary`, and `profile`.
3. It will appear on the home page and intake page.

---

## 12. Important design decisions

1. **JSON is the source of truth.** Adapters normalize the corpus at load time; downstream code never reads raw JSON.
2. **Pure engine.** `evaluateRules` has no side effects and never reads the clock. This makes it fully testable.
3. **No rule activation by candidates.** `candidate-updates.json` is only a watchlist; it cannot turn on a rule.
4. **Pending-effective downgrade.** A rule that is not in force can never be presented as `confirm_now`.
5. **Status by attention, not colour alone.** Every badge has an icon and a text label.
6. **In-memory state.** Privacy is the default; persistence is intentionally absent.

---

## 13. Legal disclaimer

Stay Valid is an **educational planning tool**, not legal advice. It does not determine immigration status and is not a substitute for a Designated School Official (DSO) or a qualified immigration attorney. Always verify deadlines and requirements with your DSO and official government sources.

---

## 14. License

This project was generated for the Stellic Pathfinders Challenge. You may use, modify, and publish it as your own work.
