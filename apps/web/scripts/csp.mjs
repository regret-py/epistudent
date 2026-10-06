// Post-build: inject a strict Content-Security-Policy <meta> into every exported page.
// GitHub Pages can't send headers, so the policy lives in the HTML. Inline scripts emitted
// by Next (hydration data, theme bootstrap) are allowed by their exact SHA-256, nothing else.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

const sha = (text) => `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

let problems = 0;
for (const file of htmlFiles(OUT)) {
  let html = readFileSync(file, "utf8");
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;

  const hashes = new Set();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) hashes.add(sha(m[1]));

  // style-src 'self' forbids inline styles: refuse to ship a page that would break
  const inlineStyles = html.match(/<style[\s>]|\sstyle="/g);
  if (inlineStyles) {
    console.error(`csp: ${file} contains inline styles (${inlineStyles.length}); remove them or the page will render unstyled.`);
    problems++;
  }

  const policy = [
    "default-src 'none'",
    `script-src 'self' ${[...hashes].join(" ")}`.trim(),
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // only Next's own RSC payloads (same origin); no third party can ever be contacted
    "connect-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}"/>`;
  // right after the charset so it governs everything that follows
  html = html.replace(/(<meta charSet="utf-8"\/>)/i, `$1${meta}`);
  if (!html.includes(meta)) html = html.replace("<head>", `<head>${meta}`);
  writeFileSync(file, html);
  console.log(`csp: ${file.replace(OUT, "out/")} (${hashes.size} inline script hashes)`);
}

if (problems) process.exit(1);
