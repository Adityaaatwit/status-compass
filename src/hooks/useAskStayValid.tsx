/**
 * Conversation state for "Ask Stay Valid".
 *
 * Lives in React state only: no localStorage, no server persistence, cleared by
 * a refresh and by "Clear my information" along with everything else.
 *
 * The important behaviour here is the order of work:
 *
 *   1. Classify and retrieve *in the browser*, and build the deterministic
 *      answer there too.
 *   2. Only contact the server when the AI layer is enabled, the student has
 *      acknowledged the disclosure, and the question is one AI could actually
 *      improve.
 *
 * So in the default configuration — AI off, no key — asking a question makes no
 * network request whatsoever. That is what lets the privacy page keep saying
 * the deterministic experience stays in this browser.
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { buildDeterministicAnswer } from "@/domain/chat/buildDeterministicAnswer";
import type { ChatMessage, RetrievedSource } from "@/domain/chat/chatTypes";
import { detectIdentifiers, identifierWarning } from "@/domain/chat/identifierDetection";
import { retrieveVerifiedContext } from "@/domain/chat/retrieveVerifiedContext";
import { classifyQuestion } from "@/domain/chat/safety";
import { useStayValid } from "@/hooks/useStayValid";

/** How many prior turns travel with a question when AI is enabled. */
const HISTORY_WINDOW = 6;

export type ChatStatus = "idle" | "thinking" | "error" | "quota_unavailable";

export interface AskState {
  messages: ChatMessage[];
  status: ChatStatus;
  /** Set when the last send was refused locally. */
  identifierWarning: string | null;
  /** True once the student has acknowledged the AI transmission disclosure. */
  acknowledged: boolean;
  /** Whether the optional AI layer is available at all. */
  aiEnabled: boolean;
  /** True when a disclosure must be shown before the next send. */
  needsDisclosure: boolean;
  ask: (question: string) => Promise<void>;
  retry: () => Promise<void>;
  acknowledge: () => void;
  clearConversation: () => void;
  canRetry: boolean;
}

let messageCounter = 0;
function nextId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function useAskStayValid(): AskState {
  const { corpus, evaluation, profile, asOfDate, hasAnswers } = useStayValid();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [warning, setWarning] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiStatusChecked, setAiStatusChecked] = useState(false);

  /** The last question, so "Try again" does not need the input to still hold it. */
  const lastQuestion = useRef<string | null>(null);
  /** Guards against a double submit racing the in-flight request. */
  const inFlight = useRef(false);

  /**
   * Asks the server whether AI is available. Runs on first interaction, never
   * on page load — a page view should not cause a request.
   */
  const ensureAiStatus = useCallback(async (): Promise<boolean> => {
    if (aiStatusChecked) return aiEnabled;
    try {
      const { getAiStatus } = await import("@/rpc/askStayValid");
      const result = await getAiStatus();
      setAiEnabled(result.aiEnabled);
      setAiStatusChecked(true);
      return result.aiEnabled;
    } catch {
      // If we cannot tell, assume not available and stay local.
      setAiEnabled(false);
      setAiStatusChecked(true);
      return false;
    }
  }, [aiEnabled, aiStatusChecked]);

  const runQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || inFlight.current) return;

      // Identifiers are caught before the message enters the conversation, so a
      // blocked message is never stored, rendered or transmitted.
      const identifiers = detectIdentifiers(trimmed);
      if (identifiers.length > 0) {
        setWarning(identifierWarning(identifiers));
        setStatus("idle");
        return;
      }
      setWarning(null);

      inFlight.current = true;
      lastQuestion.current = trimmed;
      setStatus("thinking");

      const userMessage: ChatMessage = { id: nextId("user"), role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMessage]);

      // Everything below happens locally first.
      const classification = classifyQuestion(trimmed);
      const retrieval = retrieveVerifiedContext(trimmed, corpus, evaluation);
      const localAnswer = buildDeterministicAnswer(trimmed, retrieval, classification);
      const localSources: RetrievedSource[] = retrieval.sources.filter((s) =>
        localAnswer.sourceIds.includes(s.id),
      );

      const couldAiHelp =
        !classification.blockAi && !retrieval.insufficientEvidence && retrieval.rules.length > 0;

      const available = couldAiHelp ? await ensureAiStatus() : false;

      // No disclosure yet: answer locally and let the UI prompt for consent.
      if (!available || !acknowledged) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId("assistant"),
            role: "assistant",
            text: localAnswer.answer,
            answer: localAnswer,
            sources: localSources,
          },
        ]);
        setStatus("idle");
        inFlight.current = false;
        return;
      }

      try {
        const { askStayValid } = await import("@/rpc/askStayValid");
        const response = await askStayValid({
          data: {
            question: trimmed,
            profile,
            asOfDate,
            hasAnswers,
            recentMessages: messages.slice(-HISTORY_WINDOW).map((m) => ({
              role: m.role,
              text: m.text,
            })),
          },
        });

        setMessages((prev) => [
          ...prev,
          {
            id: nextId("assistant"),
            role: "assistant",
            text: response.answer.answer,
            answer: response.answer,
            sources: response.sources,
          },
        ]);
        setStatus(response.blocked?.reason === "rate_limited" ? "quota_unavailable" : "idle");
      } catch {
        // The server is unreachable, but a good answer was already computed
        // locally — show it rather than an error.
        setMessages((prev) => [
          ...prev,
          {
            id: nextId("assistant"),
            role: "assistant",
            text: localAnswer.answer,
            answer: localAnswer,
            sources: localSources,
          },
        ]);
        setStatus("error");
      } finally {
        inFlight.current = false;
      }
    },
    [acknowledged, asOfDate, corpus, ensureAiStatus, evaluation, hasAnswers, messages, profile],
  );

  const retry = useCallback(async () => {
    if (!lastQuestion.current) return;
    // Drop the previous attempt's exchange so the retry reads as one turn.
    setMessages((prev) => {
      const lastUser = [...prev].reverse().findIndex((m) => m.role === "user");
      if (lastUser === -1) return prev;
      return prev.slice(0, prev.length - lastUser - 1);
    });
    await runQuestion(lastQuestion.current);
  }, [runQuestion]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setStatus("idle");
    setWarning(null);
    lastQuestion.current = null;
  }, []);

  const acknowledge = useCallback(() => setAcknowledged(true), []);

  return useMemo(
    () => ({
      messages,
      status,
      identifierWarning: warning,
      acknowledged,
      aiEnabled,
      needsDisclosure: aiEnabled && !acknowledged,
      ask: runQuestion,
      retry,
      acknowledge,
      clearConversation,
      canRetry:
        lastQuestion.current !== null && (status === "error" || status === "quota_unavailable"),
    }),
    [
      acknowledge,
      acknowledged,
      aiEnabled,
      clearConversation,
      messages,
      retry,
      runQuestion,
      status,
      warning,
    ],
  );
}
