import { cn } from "@/lib/utils";
import type { LegalStatus, VerificationStatus } from "@/domain/types";

/** Human labels for corpus legal statuses. Never softened or re-interpreted. */
export const LEGAL_STATUS_LABEL: Record<string, string> = {
  effective: "Active — in force",
  published_pending_effective: "Published — pending effective date",
  proposed: "Proposed — not in force",
  status_uncertain: "Status uncertain",
  delayed: "Delayed",
  stayed: "Stayed",
  enjoined: "Enjoined by a court",
  terminated: "Terminated",
  superseded: "Superseded",
};

const LEGAL_STATUS_STYLE: Record<string, string> = {
  effective: "bg-teal-soft text-attn-monitor border-teal/40",
  published_pending_effective: "bg-amber-soft text-attn-prepare border-amber/40",
  proposed: "bg-muted text-muted-foreground border-border",
  status_uncertain: "bg-attn-confirm-soft text-attn-confirm border-attn-confirm/30",
  delayed: "bg-attn-confirm-soft text-attn-confirm border-attn-confirm/30",
  stayed: "bg-attn-confirm-soft text-attn-confirm border-attn-confirm/30",
  enjoined: "bg-attn-confirm-soft text-attn-confirm border-attn-confirm/30",
  terminated: "bg-muted text-muted-foreground border-border",
  superseded: "bg-muted text-muted-foreground border-border",
};

export const VERIFICATION_LABEL: Record<string, string> = {
  verified: "Verified",
  partially_verified: "Partially verified",
  needs_review: "Unverified — needs review",
  verified_no_rule_change: "Verified, no rule change",
};

export function LegalStatusChip({
  status,
  className,
}: {
  status: LegalStatus;
  className?: string;
}) {
  const key = String(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        LEGAL_STATUS_STYLE[key] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {LEGAL_STATUS_LABEL[key] ?? key}
    </span>
  );
}

export function VerificationChip({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  const key = String(status);
  const isVerified = key === "verified" || key === "verified_no_rule_change";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        isVerified
          ? "border-teal/40 bg-teal-soft text-attn-monitor"
          : "border-attn-confirm/30 bg-attn-confirm-soft text-attn-confirm",
        className,
      )}
    >
      {VERIFICATION_LABEL[key] ?? key}
    </span>
  );
}
