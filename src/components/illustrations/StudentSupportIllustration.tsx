/**
 * Hand-drawn illustration: three students, the middle one curious, with thought
 * bubbles holding the questions Stay Valid turns into dates.
 */

import illustration from "@/assets/student-support.png";

const ALT =
  "Hand-drawn illustration of three college students standing together. The student in the middle looks thoughtful, and thought bubbles above them hold question marks, a calendar and a checklist.";

export function StudentSupportIllustration({
  className,
  decorative = false,
  priority = false,
}: {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}) {
  return (
    <img
      src={illustration}
      alt={decorative ? "" : ALT}
      aria-hidden={decorative ? true : undefined}
      width={1024}
      height={960}
      loading={priority ? "eager" : "lazy"}
      className={className}
    />
  );
}
