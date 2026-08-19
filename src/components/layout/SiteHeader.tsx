import { Link } from "@tanstack/react-router";
import { Compass, Trash2 } from "lucide-react";

import { useStayValid } from "@/hooks/useStayValid";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/check", label: "Check my situation" },
  { to: "/sources", label: "Sources" },
  { to: "/privacy", label: "Privacy" },
] as const;

export function SiteHeader() {
  const { hasAnswers, clearAll } = useStayValid();

  return (
    <header className="print-hidden sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="grid size-8 place-items-center rounded-lg bg-ink text-ink-foreground">
            <Compass aria-hidden="true" className="size-4.5" />
          </span>
          <span className="text-lg tracking-tight">Stay Valid</span>
        </Link>

        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:ml-4 sm:w-auto">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {NAV.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  activeProps={{ className: "text-foreground font-semibold" }}
                  inactiveProps={{ className: "text-muted-foreground" }}
                  className="sv-transition rounded-sm hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {hasAnswers && (
          <button
            type="button"
            onClick={clearAll}
            className="sv-transition ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Clear my information
          </button>
        )}
      </div>
    </header>
  );
}
