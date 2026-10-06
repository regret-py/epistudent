// Post-build: inject a strict Content-Security-Policy <meta> into every exported page.
// GitHub Pages can't send headers, so the policy lives in the HTML. Inline scripts emitted
// by Next (hydration data, theme bootstrap) are allowed by their exact SHA-256, nothing else.
// Fails the build if a page would ship without a policy or with inline styles.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../out/", import.meta.url));
// the only third party the page may talk to: the Supabase project (accounts + sync)
const SUPABASE_ORIGIN = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gayltuhbhsojbrfmjzvg.supabase.co").origin;

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

const sha = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
const META_RE = /<meta http-equiv="Content-Security-Policy"[^>]*>/i;

let problems = 0;
const files = htmlFiles(OUT);
if (files.length === 0) {
  console.error(`csp: no HTML found in ${OUT}`);
  process.exit(1);
}

for (const file of files) {
  const name = join("out", relative(OUT, file));
  // idempotent: drop a policy from a previous run before hashing again
  let html = readFileSync(file, "utf8").replace(META_RE, "");

  const hashes = new Set();
  for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) hashes.add(sha(m[1]));

  const inlineStyles = html.match(/<style[\s>]|\sstyle=["']/gi);
  if (inlineStyles) {
    console.error(`csp: ${name} contains ${inlineStyles.length} inline style(s); style-src 'self' would block them.`);
    problems++;
  }

  const policy = [
    "default-src 'none'",
    `script-src 'self' ${[...hashes].join(" ")}`.trim(),
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    // Next's own payloads + the Supabase API; nothing else can be contacted
    `connect-src 'self' ${SUPABASE_ORIGIN}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}"/>`;

  // right after the charset (or at the very start of <head>) so it governs everything that follows
  if (/<meta charset="utf-8"\s*\/?>/i.test(html)) html = html.replace(/(<meta charset="utf-8"\s*\/?>)/i, `$1${meta}`);
  else html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${meta}`);

  if (!html.includes(meta)) {
    console.error(`csp: could not inject the policy into ${name}`);
    problems++;
    continue;
  }
  writeFileSync(file, html);
  console.log(`csp: ${name} (${hashes.size} inline script hashes)`);
}

if (problems) process.exit(1);
