import {
  AlertTriangle,
  Eraser,
  MessageCircleQuestion,
  RotateCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { ChatMessageView } from "@/components/chat/ChatMessageView";
import { useAskStayValid } from "@/hooks/useAskStayValid";

/**
 * "Ask Stay Valid" — a supporting explanation tool, not the main event.
 *
 * The timeline remains the centre of the product, so this is a bounded panel
 * below it rather than a chat-first surface. It is deliberately usable with the
 * keyboard alone and readable on a phone.
 */

const SUGGESTED_QUESTIONS = [
  "How could the September 15 rule affect someone already admitted for D/S?",
  "What should I discuss with my DSO before traveling?",
  "Why is my program end date important?",
  "What information should I bring to an OPT appointment?",
];

export function AskStayValid() {
  const {
    messages,
    status,
    identifierWarning,
    acknowledged,
    aiEnabled,
    needsDisclosure,
    ask,
    retry,
    acknowledge,
    clearConversation,
    canRetry,
  } = useAskStayValid();

  const [draft, setDraft] = useState("");
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLUListElement>(null);
  const isBusy = status === "thinking";

  // Keep the newest turn in view without stealing focus from the input.
  useEffect(() => {
    if (messages.length === 0) return;
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages]);

  const submit = (question: string) => {
    if (!question.trim() || isBusy) return;
    setDraft("");
    void ask(question);
    // Returning focus to the input is what makes repeated asking bearable.
    inputRef.current?.focus();
  };

  return (
    <section
      aria-labelledby="ask-heading"
      className="print-hidden scroll-mt-24"
      id="ask-stay-valid"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="ask-heading"
            className="flex items-center gap-2 text-2xl font-semibold text-foreground"
          >
            <MessageCircleQuestion aria-hidden="true" className="size-6 text-accent" />
            Ask Stay Valid
          </h2>
          <p className="sv-prose mt-1 text-sm text-muted-foreground">
            Ask about anything above in your own words. Answers come from the same verified sources
            as your timeline, and always name them.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearConversation}
            className="sv-transition inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <Eraser aria-hidden="true" className="size-4" />
            Clear conversation
          </button>
        )}
      </div>

      <div className="sv-card mt-5 p-4 sm:p-5">
        {/* Standing warning, not a one-off toast: it must be visible at the
            moment a student is typing, not only before they started. */}
        <p className="flex items-start gap-2 rounded-lg border border-attn-prepare/30 bg-amber-soft p-3 text-xs text-attn-prepare">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Do not type your passport, SEVIS ID, visa, A-number or receipt number. Stay Valid does
            not need them, and will refuse to send a message that looks like it contains one.
          </span>
        </p>

        {needsDisclosure && <AiDisclosure onAcknowledge={acknowledge} />}

        {messages.length === 0 ? (
          <div className="mt-4">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Try one of these
            </h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => submit(question)}
                    className="sv-transition w-full rounded-lg border border-border bg-paper p-3 text-left text-sm text-foreground hover:border-teal hover:bg-teal-soft/50"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul
            ref={logRef}
            aria-live="polite"
            aria-label="Conversation"
            className="mt-4 max-h-[28rem] space-y-4 overflow-y-auto pr-1"
          >
            {messages.map((message) => (
              <ChatMessageView key={message.id} message={message} onAskFollowUp={submit} />
            ))}
          </ul>
        )}

        {isBusy && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none"
            />
            Looking through the verified sources…
          </p>
        )}

        {identifierWarning && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-attn-confirm/30 bg-attn-confirm-soft p-3 text-sm text-attn-confirm"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {identifierWarning}
          </p>
        )}

        {status === "quota_unavailable" && (
          <p role="status" className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm">
            The optional AI explanation is rate limited right now. Everything else — your timeline,
            checkpoints, checklist, calendar export and meeting kit — keeps working, and answers
            below still come from the verified sources.
          </p>
        )}

        {status === "error" && (
          <p role="status" className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm">
            The optional AI explanation could not be reached, so that answer was assembled directly
            from the verified sources instead.
          </p>
        )}

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            Your question
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              id={inputId}
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter is a newline. IME composition must
                // not be interrupted, or every CJK typist sends half a word.
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit(draft);
                }
              }}
              rows={2}
              maxLength={1200}
              placeholder="For example: why does my program end date matter?"
              aria-describedby={`${inputId}-hint`}
              className="w-full resize-y rounded-lg border border-border bg-paper px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal focus:ring-2 focus:ring-teal/30 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!draft.trim() || isBusy}
                className="sv-transition inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-ink-foreground hover:bg-ink/90 disabled:opacity-50"
              >
                <Send aria-hidden="true" className="size-4" />
                Send
              </button>
              {canRetry && (
                <button
                  type="button"
                  onClick={() => void retry()}
                  className="sv-transition inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  <RotateCw aria-hidden="true" className="size-4" />
                  Try again
                </button>
              )}
            </div>
          </div>
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-muted-foreground">
            Press Enter to send, Shift + Enter for a new line.{" "}
            {aiEnabled && acknowledged
              ? "Questions are sent to the configured AI provider for explanation only."
              : "Answers are assembled in this browser from the bundled verified sources."}
          </p>
        </form>
      </div>
    </section>
  );
}

/**
 * Shown once, before the first question that would be sent to a provider.
 * Answering locally needs no consent, so this only appears when AI is actually
 * available and would actually be used.
 */
function AiDisclosure({ onAcknowledge }: { onAcknowledge: () => void }) {
  return (
    <div
      role="region"
      aria-label="AI disclosure"
      className="mt-4 rounded-lg border border-teal/40 bg-teal-soft/50 p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">Before the first AI-assisted answer</h3>
      <ul className="sv-prose mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
        <li>
          Your timeline, checkpoints and dates are calculated in this browser and are not sent
          anywhere.
        </li>
        <li>
          If you continue, your <strong>question</strong>, a few non-identifying profile fields
          (such as whether your I-94 shows D/S), the matching verified rules and your recent
          messages are sent to the configured AI provider so it can explain them.
        </li>
        <li>
          The provider processes that request under its own privacy policy. Stay Valid does not
          intentionally store your conversation, and refreshing this page erases it.
        </li>
        <li>
          The AI can only rephrase verified material. It cannot create a rule, change a date, or
          decide anything about your status.
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAcknowledge}
          className="sv-transition rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
        >
          I understand — enable AI explanations
        </button>
        <span className="self-center text-xs text-muted-foreground">
          Or keep asking without it: answers stay in this browser.
        </span>
      </div>
    </div>
  );
}
