import { Mail, MailOpen, Printer } from "lucide-react";
import { useState } from "react";

import { ATTENTION_LABEL } from "@/components/shared/AttentionBadge";
import { DATE_KIND_LABEL } from "@/components/shared/DateKindBadge";
import { DISCLAIMER_TEXT } from "@/components/shared/Disclaimer";
import { LEGAL_STATUS_LABEL } from "@/components/sources/LegalStatusChip";
import type { MeetingKit } from "@/domain/types";
import { formatDate, formatDateTime } from "@/utils/dateFormatting";
import { printPage } from "@/utils/print";

export function MeetingKitView({ kit }: { kit: MeetingKit }) {
  return (
    <section aria-labelledby="kit-heading" id="meeting-kit" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="kit-heading" className="text-2xl font-semibold text-foreground">
            DSO meeting kit
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One page to bring to your advising appointment. Print it or save it as a PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={printPage}
          className="sv-transition print-hidden inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-ink-foreground hover:bg-ink/90"
        >
          <Printer aria-hidden="true" className="size-4" />
          Print or save as PDF
        </button>
      </div>

      <div className="sv-card mt-6 space-y-6 p-5 sm:p-6">
        <header className="border-b border-border pb-4">
          <h3 className="font-serif text-xl text-foreground">Stay Valid — DSO meeting kit</h3>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            <Meta label="Prepared from" value={kit.generatedFor} />
            <Meta label="Evaluated as of" value={formatDate(kit.asOfDate)} />
            <Meta label="Corpus version" value={kit.corpusVersion} />
            <Meta label="Sources last verified" value={formatDateTime(kit.researchedAsOf)} />
          </dl>
        </header>

        <KitBlock title="My situation">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {kit.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="font-medium text-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </KitBlock>

        <KitBlock title="Dates I am tracking">
          <ul className="space-y-1.5 text-sm">
            {kit.timeline
              .filter((item) => item.id !== "today")
              .map((item) => (
                <li key={item.id} className="flex flex-wrap gap-x-2">
                  <span className="font-semibold text-foreground">{formatDate(item.date)}</span>
                  <span className="text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    ({DATE_KIND_LABEL[item.kind]})
                  </span>
                </li>
              ))}
          </ul>
        </KitBlock>

        <KitBlock title="What needs my attention">
          <ul className="space-y-2 text-sm">
            {kit.findings.map((finding) => (
              <li key={finding.ruleId}>
                <span className="font-semibold text-foreground">
                  {ATTENTION_LABEL[finding.attention]}:
                </span>{" "}
                <span className="text-foreground">{finding.headline}</span>
              </li>
            ))}
          </ul>
        </KitBlock>

        <KitList title="What must be confirmed" items={kit.confirmationTopics} />
        <KitList title="Questions to ask my DSO" items={kit.questions} ordered />
        <KitList
          title="Documents and dates to bring"
          items={[...new Set(kit.findings.flatMap((f) => f.documentsOrDatesToBring))]}
        />
        <KitList
          title="Preparation checklist"
          items={kit.preparationChecklist.map((a) => a.label)}
        />

        {kit.insufficient.length > 0 && (
          <KitList
            title="Topics Stay Valid could not evaluate"
            items={kit.insufficient.map(
              (note) =>
                `${note.ruleTitle} — missing: ${note.missingInputs.join(", ") || "details"}`,
            )}
          />
        )}

        <KitBlock title="Sources used">
          <ul className="space-y-2 text-sm">
            {kit.citations.map((citation) => (
              <li key={citation.id}>
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-accent underline underline-offset-2"
                >
                  {citation.title}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {citation.publisher} —{" "}
                  {LEGAL_STATUS_LABEL[String(citation.legalStatus)] ?? citation.legalStatus}
                  {citation.lastCheckedAt
                    ? ` — last checked ${formatDateTime(citation.lastCheckedAt)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </KitBlock>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {DISCLAIMER_TEXT}
        </p>
      </div>

      <SendToDso />
    </section>
  );
}

const OUTLOOK_COMPOSE_URL = "https://outlook.office.com/mail/deeplink/compose?to=";

/**
 * Email handoff. Deliberately dumb: no recipient, no student data in either
 * URL, no attachment. A browser cannot attach a local file to a new message,
 * and this app never touches a mailbox.
 */
function SendToDso() {
  const [mailAppFailed, setMailAppFailed] = useState(false);

  function openMailApp() {
    setMailAppFailed(false);
    const before = Date.now();
    try {
      window.location.href = "mailto:";
    } catch {
      setMailAppFailed(true);
      return;
    }
    // No reliable success signal exists; if the page never lost focus shortly
    // after the attempt, assume no mail client is configured.
    window.setTimeout(() => {
      if (document.hasFocus() && Date.now() - before < 3000) setMailAppFailed(true);
    }, 1200);
  }

  return (
    <div className="sv-card print-hidden mt-6 p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Send this to your DSO</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Save your meeting kit as a PDF, open your preferred email service, enter your DSO&rsquo;s
        email address and attach the saved file. Review everything before sending.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={OUTLOOK_COMPOSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Outlook on the web in a new tab with a blank message"
          className="sv-transition inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <MailOpen aria-hidden="true" className="size-4" />
          Open Outlook
        </a>
        <button
          type="button"
          onClick={openMailApp}
          aria-label="Open a blank message in your device's email application"
          className="sv-transition inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <Mail aria-hidden="true" className="size-4" />
          Open email app
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Microsoft may ask you to sign in before the Outlook compose window opens. Both links open a
        blank message with no recipient and no information from your answers.
      </p>

      <p aria-live="polite" className="mt-2 text-xs text-attn-confirm">
        {mailAppFailed
          ? "Your browser could not open an email application. Open your email in a browser tab instead, or copy your DSO's address into a new message manually."
          : ""}
      </p>

      <ol className="mt-4 grid gap-2 text-sm text-foreground sm:grid-cols-2 lg:grid-cols-4">
        {[
          "Print or save the meeting kit as a PDF",
          "Open Outlook or your email app",
          "Enter your DSO’s email address",
          "Attach the saved PDF and review it before sending",
        ].map((step, index) => (
          <li key={step} className="rounded-lg border border-border bg-muted/40 p-3">
            <span className="block text-xs font-semibold text-muted-foreground">
              Step {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold">{label}: </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}

function KitBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold tracking-wide text-foreground uppercase">{title}</h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function KitList({
  title,
  items,
  ordered = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <KitBlock title={title}>
      <List
        className={`space-y-1 pl-5 text-sm text-foreground ${
          ordered ? "list-decimal" : "list-disc"
        }`}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    </KitBlock>
  );
}
