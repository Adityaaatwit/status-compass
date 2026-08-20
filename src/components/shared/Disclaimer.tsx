import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export const DISCLAIMER_TEXT =
  "Stay Valid is an educational preparation tool. It does not determine immigration status or provide legal advice. Rules and individual circumstances can change. Verify important decisions with your DSO, an authorized university official, or a qualified immigration attorney, and consult the linked government source.";

export const PRIVACY_TEXT =
  "No account or document upload is required. Your answers are processed in this browser and can be cleared at any time. The only feature that can send anything to a third party is the optional AI in “Ask Stay Valid” — it is off by default, asks before its first use, and is explained in full below.";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "sv-card flex gap-3 border-l-4 border-l-teal p-4 text-sm text-muted-foreground",
        className,
      )}
    >
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal" />
      <p>{DISCLAIMER_TEXT}</p>
    </aside>
  );
}

export function EducationalNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      Educational information, not legal advice
    </p>
  );
}
