import { describe, expect, it } from "vitest";
import { isEpitechEmail, onboardingSchema } from "./profile";

describe("isEpitechEmail", () => {
  it.each([
    ["jane.doe@epitech.eu", true],
    ["Jane.Doe@EPITECH.EU", true],
    [" jane@epitech.eu ", true],
    ["jane@epitech.eu.evil.com", false],
    ["jane@notepitech.eu", false],
    ["jane@gmail.com", false],
    ["", false],
    [null, false],
  ])("%s -> %s", (email, expected) => {
    expect(isEpitechEmail(email)).toBe(expected);
  });
});

describe("onboardingSchema", () => {
  const valid = {
    promo: "tek2",
    city: "paris",
    languages: { c: 4, python: 2 },
    availability: ["weekday", "evening", "evening"],
  };

  it("accepts a valid payload and dedupes slots", () => {
    const parsed = onboardingSchema.parse(valid);
    expect(parsed.availability).toEqual(["weekday", "evening"]);
    expect(parsed.matchmakingOptIn).toBe(false);
  });

  it("rejects out-of-range skill levels", () => {
    expect(onboardingSchema.safeParse({ ...valid, languages: { c: 6 } }).success).toBe(false);
  });

  it("requires at least one language and one slot", () => {
    expect(onboardingSchema.safeParse({ ...valid, languages: {} }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, availability: [] }).success).toBe(false);
  });

  it("rejects unknown promos and cities", () => {
    expect(onboardingSchema.safeParse({ ...valid, promo: "tek9" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, city: "atlantis" }).success).toBe(false);
  });
});
