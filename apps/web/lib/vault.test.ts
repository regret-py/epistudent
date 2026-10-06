import { describe, expect, it } from "vitest";
import { WrongPassphraseError, deriveKey, isEnvelope, open, openWithKey, passphraseStrength, seal } from "./vault";

// fewer iterations keep the suite fast; production uses PBKDF2_ITERATIONS
const FAST = 100_000;

describe("vault", () => {
  it("round-trips and never stores the plaintext", async () => {
    const key = await deriveKey("correct horse battery", undefined, FAST);
    const env = await seal(key, '{"label":"Loyer secret"}');
    expect(isEnvelope(env)).toBe(true);
    expect(JSON.stringify(env)).not.toContain("Loyer");
    const { plaintext } = await open(env, "correct horse battery");
    expect(plaintext).toBe('{"label":"Loyer secret"}');
  });

  it("uses a fresh IV for every save", async () => {
    const key = await deriveKey("pass-phrase", undefined, FAST);
    const a = await seal(key, "same");
    const b = await seal(key, "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it("rejects a wrong code", async () => {
    const env = await seal(await deriveKey("right-code", undefined, FAST), "x");
    await expect(open(env, "wrong-code")).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("detects tampering (GCM authentication)", async () => {
    const env = await seal(await deriveKey("right-code", undefined, FAST), "hello world");
    const bytes = Uint8Array.from(atob(env.data), (c) => c.charCodeAt(0));
    bytes[0] = bytes[0]! ^ 1;
    const tampered = { ...env, data: btoa(String.fromCharCode(...bytes)) };
    await expect(open(tampered, "right-code")).rejects.toBeInstanceOf(WrongPassphraseError);
    await expect(open({ ...env, iv: "!!!" }, "right-code")).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("reuses the in-memory key only for the same salt", async () => {
    const key = await deriveKey("right-code", undefined, FAST);
    const env = await seal(key, "sync");
    expect(await openWithKey(env, key)).toBe("sync");
    const other = await deriveKey("right-code", undefined, FAST);
    await expect(openWithKey(env, other)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("refuses envelopes with weak or absurd parameters", () => {
    const base = { format: "epistudent-vault", v: 1, kdf: "PBKDF2-SHA256", salt: "", iv: "", data: "" };
    expect(isEnvelope({ ...base, iterations: 1000 })).toBe(false);
    expect(isEnvelope({ ...base, iterations: 1e9 })).toBe(false);
    expect(isEnvelope({ ...base, iterations: 600_000 })).toBe(true);
    expect(isEnvelope({ entries: [] })).toBe(false);
  });

  it("rates passphrases", () => {
    expect(passphraseStrength("123456")).toBe("faible");
    expect(passphraseStrength("Budget2026")).toBe("moyen");
    expect(passphraseStrength("mon chat mange des pâtes")).toBe("fort");
  });
});
