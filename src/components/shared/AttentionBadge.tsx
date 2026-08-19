import { AlertTriangle, CalendarClock, Eye, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Attention } from "@/domain/types";

/** The only four labels the product is allowed to show. */
export const ATTENTION_LABEL: Record<Attention, string> = {
  confirm_now: "Confirm now",
  prepare: "Prepare",
  monitor: "Monitor",
  information: "Information",
};

const STYLES: Record<Attention, string> = {
  confirm_now: "bg-attn-confirm-soft text-attn-confirm border-attn-confirm/30",
  prepare: "bg-attn-prepare-soft text-attn-prepare border-attn-prepare/30",
  monitor: "bg-attn-monitor-soft text-attn-monitor border-attn-monitor/30",
  information: "bg-attn-info-soft text-attn-info border-attn-info/25",
};

const ICONS: Record<Attention, typeof Info> = {
  confirm_now: AlertTriangle,
  prepare: CalendarClock,
  monitor: Eye,
  information: Info,
};

export function AttentionBadge({
  attention,
  className,
}: {
  attention: Attention;
  className?: string;
}) {
  const Icon = ICONS[attention];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase",
        STYLES[attention],
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {ATTENTION_LABEL[attention]}
    </span>
  );
}
