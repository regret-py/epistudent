/** Account profile: a nickname and a small square photo, stored with the budget (so RLS covers it). */
export type Profile = { name: string; avatar: string };

export const emptyProfile = (): Profile => ({ name: "", avatar: "" });

export const NAME_MAX = 24;
/** Base64 characters; keeps the whole budget row far under the database's 20 kB limit. */
export const AVATAR_MAX = 12_000;
const AVATAR_SIZE = 128;
const AVATAR_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function cleanName(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, NAME_MAX) : "";
}

/** Only small raster data URLs: never SVG, never a remote URL (the CSP would block it anyway). */
export function cleanAvatar(v: unknown): string {
  return typeof v === "string" && v.length <= AVATAR_MAX && AVATAR_RE.test(v) ? v : "";
}

export function cleanProfile(raw: unknown): Profile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyProfile();
  const r = raw as Record<string, unknown>;
  return { name: cleanName(r.name), avatar: cleanAvatar(r.avatar) };
}

export type AvatarError = "type" | "size" | "decode";

/** Center-crops the picture to a 128 px square JPEG, compressed until it fits. */
export async function avatarFromFile(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/.test(file.type)) throw new Error("type" satisfies AvatarError);
  if (file.size > 15 * 1024 * 1024) throw new Error("size" satisfies AvatarError);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("decode" satisfies AvatarError);
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx || !side) throw new Error("decode" satisfies AvatarError);
  ctx.fillStyle = "#fff"; // transparent PNGs get a paper background, not black
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  for (const q of [0.85, 0.7, 0.55, 0.4, 0.25]) {
    const url = cleanAvatar(canvas.toDataURL("image/jpeg", q));
    if (url) return url;
  }
  throw new Error("size" satisfies AvatarError);
}
