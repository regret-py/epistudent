/**
 * Optional at-rest encryption of the budget in localStorage (WebCrypto only, no dependency).
 * PBKDF2-SHA256 (600 000 iterations, OWASP 2023) derives an AES-256-GCM key from the user's
 * code; every save uses a fresh random IV. The key is non-extractable and only lives in memory.
 */

export const VAULT_FORMAT = "epistudent-vault";
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 6;

export type VaultEnvelope = {
  format: typeof VAULT_FORMAT;
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  data: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const s = atob(value);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function random(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

export type VaultKey = { key: CryptoKey; salt: Uint8Array<ArrayBuffer>; iterations: number };

export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer> = random(16), iterations = PBKDF2_ITERATIONS): Promise<VaultKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { key, salt, iterations };
}

export async function seal(vault: VaultKey, plaintext: string): Promise<VaultEnvelope> {
  const iv = random(12);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, vault.key, encoder.encode(plaintext)));
  return { format: VAULT_FORMAT, v: 1, kdf: "PBKDF2-SHA256", iterations: vault.iterations, salt: toBase64(vault.salt), iv: toBase64(iv), data: toBase64(data) };
}

export function isEnvelope(value: unknown): value is VaultEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.format === VAULT_FORMAT &&
    v.v === 1 &&
    typeof v.iterations === "number" &&
    Number.isInteger(v.iterations) &&
    // refuse absurd values from a crafted file (too weak or a CPU-burning DoS)
    v.iterations >= 100_000 &&
    v.iterations <= 5_000_000 &&
    typeof v.salt === "string" &&
    typeof v.iv === "string" &&
    typeof v.data === "string"
  );
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("Code incorrect.");
    this.name = "WrongPassphraseError";
  }
}

/** Derives the key from the envelope's own salt and decrypts. Throws WrongPassphraseError on a bad code or tampered data. */
export async function open(envelope: VaultEnvelope, passphrase: string): Promise<{ vault: VaultKey; plaintext: string }> {
  let salt: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>;
  try {
    salt = fromBase64(envelope.salt);
    iv = fromBase64(envelope.iv);
    data = fromBase64(envelope.data);
  } catch {
    throw new WrongPassphraseError();
  }
  if (salt.length !== 16 || iv.length !== 12) throw new WrongPassphraseError();
  const vault = await deriveKey(passphrase, salt, envelope.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, vault.key, data);
    return { vault, plaintext: decoder.decode(plain) };
  } catch {
    throw new WrongPassphraseError();
  }
}

/** Very rough strength hint shown while choosing a code. */
export function passphraseStrength(p: string): "faible" | "moyen" | "fort" {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/, /\s/].filter((re) => re.test(p)).length;
  if (p.length >= 16 || (p.length >= 12 && classes >= 3)) return "fort";
  if (p.length >= 10 || (p.length >= 8 && classes >= 2)) return "moyen";
  return "faible";
}

/** Decrypts with an already-derived key (same salt), e.g. when another tab saved. */
export async function openWithKey(envelope: VaultEnvelope, vault: VaultKey): Promise<string> {
  if (envelope.salt !== toBase64(vault.salt) || envelope.iterations !== vault.iterations) throw new WrongPassphraseError();
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, vault.key, fromBase64(envelope.data));
    return decoder.decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}
