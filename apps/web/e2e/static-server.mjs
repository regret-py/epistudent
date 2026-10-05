// Serves the static export the way GitHub Pages does: /dir -> /dir/ -> /dir/index.html, 404.html fallback.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = normalize(join(process.cwd(), process.argv[2] ?? "out"));
const port = Number(process.argv[3] ?? 3100);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function stat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!path.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  let file = path;
  let s = stat(file);
  if (s?.isDirectory()) {
    if (!url.pathname.endsWith("/")) {
      res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
      return;
    }
    file = join(file, "index.html");
    s = stat(file);
  }
  if (!s && stat(`${path}.html`)) {
    file = `${path}.html`;
    s = stat(file);
  }
  const status = s ? 200 : 404;
  if (!s) file = join(root, "404.html");
  res.writeHead(status, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`static server on http://127.0.0.1:${port}`));
