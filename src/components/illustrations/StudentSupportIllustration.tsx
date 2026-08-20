/**
 * Original line illustration: three students, the middle one thinking, with a
 * thought cloud holding the questions Stay Valid turns into dates.
 *
 * Inline SVG on purpose — no network request, scales cleanly, and inherits the
 * navy/teal tokens so it stays on-brand in either theme.
 */

const ALT =
  "Line drawing of three college students standing together. The student in the middle is thinking, and a thought cloud above holds question marks, a calendar, a compass and a checklist.";

export function StudentSupportIllustration({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  const titleId = "sv-illustration-title";

  return (
    <svg
      viewBox="0 0 420 300"
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      {...(decorative ? {} : { "aria-labelledby": titleId })}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {!decorative && <title id={titleId}>{ALT}</title>}

      {/* thought cloud */}
      <g className="text-teal" stroke="var(--color-teal)">
        <path
          d="M196 24c-14 0-24 9-25 20-12 1-20 9-20 19 0 11 10 20 23 20h96c14 0 24-9 24-20 0-10-8-18-19-20-2-12-13-21-27-21-8 0-15 3-20 8-6-4-13-6-32-6Z"
          fill="var(--color-teal-soft)"
        />
        <circle cx="176" cy="96" r="6" fill="var(--color-teal-soft)" />
        <circle cx="166" cy="110" r="3.5" fill="var(--color-teal-soft)" />
      </g>

      {/* cloud contents: question marks, calendar, compass, checklist */}
      <g stroke="var(--color-ink)">
        <path d="M181 47c0-5 4-8 9-8s9 3 9 8c0 4-3 5-6 7-2 1-3 3-3 5" />
        <path d="M190 68h.01" strokeWidth={3} />
        <path d="M296 44c0-4 3-6 7-6s6 2 6 6-2 4-4 5-3 2-3 4" />
        <path d="M302 62h.01" strokeWidth={3} />

        <rect x="214" y="38" width="34" height="30" rx="4" />
        <path d="M214 48h34M222 38v-6M240 38v-6M223 57h6M235 57h6" />

        <circle cx="272" cy="53" r="14" />
        <path d="m277 46-7 12-4-8Z" fill="var(--color-teal)" stroke="none" />
        <circle cx="272" cy="53" r="1.6" fill="var(--color-ink)" stroke="none" />

        <rect x="322" y="38" width="26" height="32" rx="4" />
        <path d="m327 50 3 3 5-6M327 61l3 3 5-6M340 51h4M340 62h4" />
      </g>

      {/* students */}
      <g stroke="var(--color-ink)">
        {/* left student — hand on the centre student's shoulder */}
        <circle cx="88" cy="150" r="20" />
        <path d="M78 148c2 3 6 5 10 5s8-2 10-5" />
        <path d="M80 144h5M91 144h5" strokeWidth={2.6} />
        <path d="M68 172c-9 5-14 14-14 25v57h68v-57c0-11-5-20-14-25" />
        <path d="M126 198c10 2 20 0 28-6" />

        {/* centre student — thoughtful, chin on hand */}
        <circle cx="210" cy="158" r="24" />
        <path d="M198 152h6M216 152h6" strokeWidth={2.8} />
        <path d="M201 170c4 2 10 2 15 0" />
        <path d="M186 184c-11 6-17 17-17 29v41h82v-41c0-12-6-23-17-29" />
        <path d="m196 254 6-38M224 254l-6-38" />
        <path d="M223 188c8 4 12 10 12 17l-14 5" />

        {/* right student — offering a shared checklist */}
        <circle cx="330" cy="152" r="20" />
        <path d="M320 156c3 3 7 4 10 4s7-1 10-4" />
        <path d="M322 146h5M333 146h5" strokeWidth={2.6} />
        <path d="M312 174c-10 5-15 14-15 25v55h64v-55c0-11-5-20-15-25" />
        <rect
          x="278"
          y="196"
          width="30"
          height="24"
          rx="3"
          fill="var(--color-teal-soft)"
          stroke="var(--color-teal)"
        />
        <path d="m283 205 3 3 5-6M283 214h13" stroke="var(--color-teal)" />
      </g>

      {/* ground line: uncertainty resolving into a clear path */}
      <path
        d="M40 262h340"
        stroke="var(--color-border)"
        strokeWidth={2}
        strokeDasharray="1 10"
      />
    </svg>
  );
}
