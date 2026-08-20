import { Bot, Sparkles, User } from "lucide-react";

import { ChatSourceCard } from "@/components/chat/ChatSourceCard";
import type { ChatMessage } from "@/domain/chat/chatTypes";

/**
 * One turn of the conversation.
 *
 * Every assistant answer states where it came from. A student needs to be able
 * to tell a quoted rule from a rephrased one, so the origin badge is always
 * present — never only on the AI path.
 */
export function ChatMessageView({
  message,
  onAskFollowUp,
}: {
  message: ChatMessage;
  onAskFollowUp: (question: string) => void;
}) {
  if (message.role === "user") {
    return (
      <li className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-ink-foreground">
          <span className="sr-only">You asked: </span>
          <User aria-hidden="true" className="mr-1.5 inline size-3.5 align-[-2px] opacity-60" />
          {message.text}
        </div>
      </li>
    );
  }

  const answer = message.answer;
  const isAi = answer?.origin === "gemini" || answer?.origin === "groq";

  return (
    <li className="flex justify-start">
      <div className="w-full max-w-[95%] space-y-3">
        <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {isAi ? (
              <Sparkles aria-hidden="true" className="size-3.5" />
            ) : (
              <Bot aria-hidden="true" className="size-3.5" />
            )}
            {isAi ? "Explained by AI from verified sources" : "Quoted from verified sources"}
          </p>
          <span className="sr-only">Stay Valid answered: </span>
          {/* Answers are plain text with newlines; whitespace-pre-line keeps the
              bullet lists the deterministic builder produces readable. */}
          <p className="sv-prose mt-2 text-sm whitespace-pre-line text-foreground">
            {message.text}
          </p>
        </div>

        {message.sources && message.sources.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sources
            </h4>
            <ul className="mt-2 grid gap-2">
              {message.sources.map((source) => (
                <ChatSourceCard key={source.id} source={source} />
              ))}
            </ul>
          </div>
        )}

        {answer?.needsDsoConfirmation && (
          <p className="rounded-lg border border-attn-confirm/30 bg-attn-confirm-soft px-3 py-2 text-xs text-attn-confirm">
            Ask your DSO to confirm this before you act on it. Stay Valid cannot determine your
            status or your eligibility.
          </p>
        )}

        {answer && answer.followUpQuestions.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              You could ask next
            </h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {answer.followUpQuestions.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => onAskFollowUp(question)}
                    className="sv-transition rounded-full border border-border bg-paper px-3 py-1.5 text-left text-xs text-foreground hover:border-teal hover:bg-teal-soft/50"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}
