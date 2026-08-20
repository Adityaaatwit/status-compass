# Architecture

## The one-sentence version

A pure rules engine turns a non-identifying profile plus a versioned research
corpus into dated checkpoints; everything else — timeline, pathways, checklist,
meeting kit, chat — is a projection of that single evaluation, and the optional
AI layer may only rephrase what the engine already produced.

---

## 1. Layers

```
src/data/*.json          research corpus (read-only source of truth)
        │
        ▼
src/domain/dataAdapters  normalise raw JSON -> typed records, once at load
src/domain/dataValidation report usability; never rewrite
        │
        ▼
src/domain/evaluateRules pure: (profile, corpus, asOfDate) -> EvaluationResult
        │
        ├── buildTimeline    ─┐
        ├── buildPathways     │  projections of one evaluation
        ├── buildChecklist    │
        └── buildMeetingKit  ─┘
        │
        ▼
src/domain/chat/         retrieval + deterministic answers (browser)
        │
        ▼  (optional, only when AI is enabled and acknowledged)
src/rpc/askStayValid     server function — the RPC boundary
        │
        ▼
src/server/ai/           provider abstraction, prompts, validation (server-only)
```

Two rules make the whole thing testable:

- **`src/domain/` is pure.** No React, no I/O, no clock. `asOfDate` is captured
  once per session in `useStayValid` and threaded through explicitly.
- **The corpus is never edited by code.** Adapters normalise on read; validation
  reports rather than repairs.

---

## 2. The rules engine

`evaluateRules(profile, corpus, asOfDate) -> EvaluationResult`

Per rule, in order:

1. **Classification filter** — skip if `classifications` excludes the student.
2. **Active window** — skip if `asOfDate > activeUntil`.
3. **Predicates** — `appliesWhen.all` / `.any` / `.not`. `"unsure"` never
   satisfies a predicate.
4. **Self-reported gates** — see §3.
5. **Required inputs** — a missing value yields an `InsufficientInfoNote` with
   `reason: "missing_input"`, never a guess.
6. **Gate and legal status** — `pendingEffective` is true when
   `doNotActivateBefore`/`activeFrom` has not been reached, or the status is
   `published_pending_effective`, or the status is non-operative (`proposed`,
   `delayed`, `stayed`, `enjoined`, `terminated`, `superseded`,
   `status_uncertain`).
7. **Dates** — computed only when the gate has passed, the status is operative,
   and `calculation.isLegalDeadline` is true. Otherwise any date produced is
   downgraded from `official` to `needs_confirmation`.

Attention is downgraded for pending rules: a rule not yet in force can never be
shown as `confirm_now`.

### Invariants worth stating

| Invariant | Enforced by |
| --- | --- |
| Same profile + corpus + `asOfDate` -> identical output | Purity; asserted by test |
| Candidate updates cannot activate a rule | `mustNotActivateRules` forced true in the adapter; engine reads candidates only to *list* related updates |
| Missing information -> explicit note, never a guess | Step 5 and step 4 |
| Publication ≠ in force | Step 6/7; scheduled effective dates are `needs_confirmation` |
| Visa / I-20 / EAD / I-94 dates stay distinct | Separate profile fields, separate `DerivedDate` entries, separate labels |

---

## 3. Self-reported gates

Some predicates depend on a question Stay Valid is not competent to answer —
principally *"are you maintaining status?"*.

An ordinary failed predicate skips its rule silently. For these, silence would
imply *"this does not apply to you"*, which is itself a status determination. So:

- answered `"yes"` → the rule matches, and the `Finding` carries a
  `SelfReportedGate` that the UI renders as *"based on your own answer, not a
  verified fact"*;
- anything else → an `InsufficientInfoNote` with
  `reason: "self_reported_gate"`, pointing at the DSO.

`InsufficientInfo` renders the two reasons as separate sections, because *"you
have not entered a date"* and *"nobody here can answer this"* are different
problems and only one of them is the student's to solve.

---

## 4. Date kinds

Every date carries provenance. This is the product's core honesty mechanism.

| Kind | Meaning |
| --- | --- |
| `official` | Stated or computed from a government source in force |
| `document` | The student typed it off their own paperwork |
| `reminder` | Stay Valid preparation prompt — **not** a government deadline |
| `needs_confirmation` | Depends on a rule not yet in force, or uncertain |

It survives into the `.ics` export, so a checkpoint read months later out of
context still says what it is.

---

## 5. Ask Stay Valid

### 5.1 Order of work

```
question
   │
   ├─ classifyQuestion()          ── blocked category? -> approved wording, stop
   ├─ detectIdentifiers()         ── identifier found? -> refuse to send, stop
   ├─ retrieveVerifiedContext()   ── nothing relevant? -> insufficient evidence
   ├─ buildDeterministicAnswer()  ── the answer, unless AI improves on it
   │
   └─ (only if AI enabled AND acknowledged AND the question could benefit)
        └─ server: provider -> validate -> use, or keep the deterministic answer
```

The deterministic answer is built **before** any network call, so every failure
path is already handled and no student is ever shown an error instead of
content.

### 5.2 The default configuration makes no network request

With `AI_CHAT_ENABLED=false` (the default), classification, retrieval and answer
construction all run in the browser. Nothing is transmitted. This is what lets
the privacy page say the deterministic experience stays in your browser without
qualification.

### 5.3 Retrieval

Weighted whole-word matching over verified rules and sources, with a bonus for
rules that produced one of *this* student's findings — the question is nearly
always about what they were just shown. Capped at 4 rules and 5 sources, because
the result set is also the only context a provider ever receives.

`candidate-updates.json` is never searched and never returned. Only sources with
`verificationStatus` of `verified` or `verified_no_rule_change` are citable.

### 5.4 Safety classification

Runs before retrieval. Categories with reviewed, fixed wording never reach a
model at all: status determination, legal advice, enforcement/emergency, and
out-of-scope. Enforcement outranks everything else.

---

## 6. The AI layer

### 6.1 Boundary enforcement

- Everything under `src/server/ai/` carries
  `import "@tanstack/react-start/server-only"`.
- The framework's import-protection plugin denies any client-reachable import
  under `**/server/**`. This is why `createServerFn` lives in `src/rpc/` and the
  implementation in `src/server/ai/`: the RPC stub is safe for the client, the
  implementation is not.
- Providers use `fetch`, not SDKs — no dependency that could resolve
  client-side, and no new runtime dependencies at all.

### 6.2 What is transmitted

Exactly this, and nothing else:

- the question (truncated to `AI_MAX_QUESTION_CHARS`);
- non-identifying profile fields — I-94 notation, academic stage, OPT stage,
  travel planned, and **whether** a program-end/EAD date exists, not the dates;
- the retrieved rules, including dates the engine already derived;
- limited source metadata;
- up to `AI_MAX_HISTORY_MESSAGES` recent messages.

The RPC re-runs retrieval and evaluation server-side rather than trusting
client-supplied context, so a crafted request cannot smuggle text into the
prompt.

### 6.3 Provider chain

`Gemini → Groq → deterministic`

The fallback fires **only** on `timeout`, `rate_limited` or `server_error`. It
does not fire on a safety refusal (that would make the fallback a way to shop
for a permissive model), an invalid request (same bad request, second quota), or
failed validation. One retry per provider, exponential backoff with full jitter.

### 6.4 Two-stage validation

Structured output guarantees *formatting*, never *truthfulness*. After the Zod
schema, `validateGroundedOutput`:

1. strips source IDs that were not supplied, and **discards** an answer whose
   citations were *all* invented;
2. rejects any answer matching a forbidden assertion — status, eligibility,
   legality, predicted outcome, or advice to leave/remain;
3. rejects any answer containing a date absent from the supplied context, as a
   fabricated legal deadline;
4. forces `needsDsoConfirmation` true — the model may raise it, never lower it;
5. overrides `safetyCategory` with the locally computed one, so a model cannot
   reclassify its way out of a blocked category.

Anything rejected falls back to the deterministic answer.

### 6.5 Quota protection

Per-client request window, duplicate suppression, circuit breaker with cooldown,
capped context (whole rules dropped rather than truncated mid-sentence), capped
history, capped output tokens, request timeout. No AI call on page load. No AI
call for the timeline, checklist, pathways or meeting kit.

---

## 7. State

`useStayValid` holds everything in React state: profile, `asOfDate`, and the
memoised projections. No `localStorage`, no cookies, no server persistence.

`useAskStayValid` holds the conversation the same way. `clearAll` increments
`clearCount`, and `/plan` keys the chat panel on it — so "Clear my information"
remounts the panel and discards the conversation and the AI acknowledgement,
rather than depending on an effect that could drift out of sync.

---

## 8. Routes

| File | URL | Purpose |
| --- | --- | --- |
| `__root.tsx` | — | Shell, providers, skip link |
| `index.tsx` | `/` | Landing, demo scenarios |
| `check.tsx` | `/check` | Intake questionnaire |
| `plan.tsx` | `/plan` | Timeline, findings, **Ask Stay Valid**, pathways, meeting kit |
| `sources.tsx` | `/sources` | Full source list and candidate updates |
| `privacy.tsx` | `/privacy` | Privacy, including the AI disclosure |

`routeTree.gen.ts` is generated. Do not edit it.

---

## 9. Extending

**A new rule** — add it to `rules.json`; add any new predicate to `PREDICATES`;
add a calculator keyed by rule ID if it computes dates; add resolvers to
`REQUIRED_INPUT_RESOLVERS`; add boundary tests.

**A new source** — add it to `sources.json` and reference its ID from a rule.
Set `verificationStatus` deliberately: only `verified` and
`verified_no_rule_change` are citable in chat.

**A new provider** — implement `AiChatProvider` in `src/server/ai/`, add it to
the `ProviderName` union and `resolveProvider`. The pipeline, validation and
quota logic need no changes.

**A new self-reported gate** — add an entry to `SELF_REPORTED_GATES` with its
question, reader, labels, caveat and blocked message.
