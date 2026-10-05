import { describe, expect, it } from "vitest";
import { urgencyOf } from "./format";

describe("urgencyOf", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  it.each([
    [null, "none"],
    ["2026-10-05T11:00:00Z", "overdue"],
    ["2026-10-05T20:00:00Z", "today"],
    ["2026-10-07T12:00:00Z", "soon"],
    ["2026-10-20T12:00:00Z", "later"],
  ] as const)("%s -> %s", (deadline, expected) => {
    expect(urgencyOf(deadline, now)).toBe(expected);
  });
});
