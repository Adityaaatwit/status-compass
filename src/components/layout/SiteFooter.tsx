import { Link } from "@tanstack/react-router";

import { useStayValid } from "@/hooks/useStayValid";
import { formatDateTime } from "@/utils/dateFormatting";

export function SiteFooter() {
  const { corpus } = useStayValid();

  return (
    <footer className="print-hidden mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-serif text-lg text-foreground">Stay Valid</p>
          <p className="mt-2 text-sm text-muted-foreground">
            From immigration uncertainty to a verified next step.
          </p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link to="/check" className="hover:text-foreground">
                Check my situation
              </Link>
            </li>
            <li>
              <Link to="/sources" className="hover:text-foreground">
                Official sources
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
          </ul>
        </nav>
        <div className="text-sm text-muted-foreground">
          <p>
            Corpus version{" "}
            <span className="font-medium text-foreground">{corpus.rules.corpusVersion}</span>
          </p>
          <p className="mt-1">
            Last verified{" "}
            <span className="font-medium text-foreground">
              {formatDateTime(corpus.rules.researchedAsOf)}
            </span>
          </p>
          <p className="mt-3">Educational information, not legal advice.</p>
        </div>
      </div>
    </footer>
  );
}
