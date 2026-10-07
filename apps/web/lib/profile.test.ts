import { describe, expect, it } from "vitest";
import { AVATAR_MAX, cleanAvatar, cleanName, cleanProfile } from "./profile";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

describe("profile", () => {
  it("keeps a nickname, without control characters, capped", () => {
    expect(cleanName("  léa\u0000 ")).toBe("  léa ");
    expect(cleanName("x".repeat(40))).toHaveLength(24);
    expect(cleanName(42)).toBe("");
  });

  it("accepts only small raster data URLs", () => {
    expect(cleanAvatar(PNG)).toBe(PNG);
    expect(cleanAvatar("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe("");
    expect(cleanAvatar("https://evil.example/a.png")).toBe("");
    expect(cleanAvatar('data:image/png;base64,AAAA" onerror="alert(1)')).toBe("");
    expect(cleanAvatar(`data:image/jpeg;base64,${"A".repeat(AVATAR_MAX)}`)).toBe("");
  });

  it("survives junk", () => {
    expect(cleanProfile(null)).toEqual({ name: "", avatar: "" });
    expect(cleanProfile([1])).toEqual({ name: "", avatar: "" });
    expect(cleanProfile({ name: "léa", avatar: PNG, extra: 1 })).toEqual({ name: "léa", avatar: PNG });
  });
});
