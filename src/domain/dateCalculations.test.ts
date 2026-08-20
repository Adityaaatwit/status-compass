/**
 * Date maths underpins every deadline the product shows. A one-day error here
 * is a student filing a day late, so the boundaries get explicit tests rather
 * than being assumed.
 */

import { describe, expect, it } from "vitest";

import {
  addDays,
  addYears,
  capAt,
  diffInDays,
  isValidIsoDate,
  maxDate,
  minDate,
  toIsoDate,
} from "./dateCalculations";

describe("isValidIsoDate", () => {
  it("accepts real calendar dates", () => {
    for (const d of ["2026-09-15", "2024-02-29", "2000-02-29", "2026-12-31"]) {
      expect(isValidIsoDate(d)).toBe(true);
    }
  });

  it("rejects dates that look right but do not exist", () => {
    for (const d of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-04-31"]) {
      expect(isValidIsoDate(d)).toBe(false);
    }
  });

  it("rejects malformed values", () => {
    for (const d of ["2026-9-15", "15/09/2026", "", "today", null, undefined, 20260915]) {
      expect(isValidIsoDate(d)).toBe(false);
    }
  });
});

describe("toIsoDate", () => {
  it("passes a valid date through", () => {
    expect(toIsoDate("2026-09-15")).toBe("2026-09-15");
  });

  it("trims a timestamp down to its date", () => {
    expect(toIsoDate("2026-09-15T23:59:59-04:00")).toBe("2026-09-15");
  });

  it("returns null rather than guessing", () => {
    expect(toIsoDate("not a date")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate("2026-02-30T00:00:00Z")).toBeNull();
  });
});

describe("addDays", () => {
  it("adds the 60-day grace period correctly", () => {
    expect(addDays("2026-12-18", 60)).toBe("2027-02-16");
  });

  it("adds the 30-day departure period correctly", () => {
    expect(addDays("2026-09-15", 30)).toBe("2026-10-15");
  });

  it("subtracts for the 90-day OPT filing window", () => {
    expect(addDays("2026-12-18", -90)).toBe("2026-09-19");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("skips Feb 29 in a non-leap year", () => {
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("returns null for an invalid input rather than a wrong date", () => {
    expect(addDays("not-a-date", 60)).toBeNull();
    expect(addDays("2026-02-30", 1)).toBeNull();
  });

  it("is a no-op for zero", () => {
    expect(addDays("2026-09-15", 0)).toBe("2026-09-15");
  });
});

describe("addYears", () => {
  it("applies the four-year admission cap", () => {
    expect(addYears("2026-09-15", 4)).toBe("2030-09-15");
  });

  it("clamps Feb 29 to Feb 28 in a non-leap target year", () => {
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
  });

  it("keeps Feb 29 when the target year is also a leap year", () => {
    expect(addYears("2028-02-29", 4)).toBe("2032-02-29");
  });
});

describe("diffInDays", () => {
  it("is positive when the second date is later", () => {
    expect(diffInDays("2026-09-15", "2026-09-16")).toBe(1);
  });

  it("is negative when the second date is earlier", () => {
    expect(diffInDays("2026-09-16", "2026-09-15")).toBe(-1);
  });

  it("is zero for the same day", () => {
    expect(diffInDays("2026-09-15", "2026-09-15")).toBe(0);
  });

  it("counts the grace period exactly", () => {
    expect(diffInDays("2026-12-18", "2027-02-16")).toBe(60);
  });

  it("is unaffected by daylight-saving transitions", () => {
    // US DST ends 2026-11-01. A naive local-time implementation returns 30.5
    // here and rounds unpredictably.
    expect(diffInDays("2026-10-15", "2026-11-15")).toBe(31);
    expect(diffInDays("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("returns null for invalid input", () => {
    expect(diffInDays("nope", "2026-09-15")).toBeNull();
  });
});

describe("minDate / maxDate", () => {
  it("ignores nulls and invalid values", () => {
    expect(minDate(null, "2026-09-15", undefined, "bad")).toBe("2026-09-15");
    expect(maxDate(null, "2026-09-15", "2028-05-12")).toBe("2028-05-12");
  });

  it("returns null when nothing is valid", () => {
    expect(minDate(null, undefined, "")).toBeNull();
    expect(maxDate(null, undefined)).toBeNull();
  });

  it("picks the earliest and latest correctly", () => {
    const dates = ["2028-05-12", "2026-09-15", "2030-11-14"];
    expect(minDate(...dates)).toBe("2026-09-15");
    expect(maxDate(...dates)).toBe("2030-11-14");
  });
});

describe("capAt", () => {
  const TRANSITION_CAP = "2030-11-14";

  it("caps a date past the transition cap", () => {
    expect(capAt("2032-01-01", TRANSITION_CAP)).toBe(TRANSITION_CAP);
  });

  it("leaves a date before the cap alone", () => {
    expect(capAt("2028-05-12", TRANSITION_CAP)).toBe("2028-05-12");
  });

  it("leaves a date exactly on the cap alone", () => {
    expect(capAt(TRANSITION_CAP, TRANSITION_CAP)).toBe(TRANSITION_CAP);
  });

  it("returns null for an invalid date", () => {
    expect(capAt(null, TRANSITION_CAP)).toBeNull();
  });
});
