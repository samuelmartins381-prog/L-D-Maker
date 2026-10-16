// Static HTTP server for built modules (Lighthouse and layout checks need http://, not file://).
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function serveDir(
  root: string,
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://x").pathname,
    );
    const path = normalize(
      join(root, pathname.endsWith("/") ? `${pathname}index.html` : pathname),
    );
    if (!path.startsWith(root)) return void res.writeHead(403).end();
    try {
      if (!(await stat(path)).isFile()) throw new Error();
      // Long cache for hashed assets, as a real host would do (Lighthouse audits caching).
      const cache = /-[\w-]{8}\.(js|css|woff2)$/.test(path)
        ? "public, max-age=31536000, immutable"
        : "no-cache";
      res.writeHead(200, {
        "content-type": TYPES[extname(path)] ?? "application/octet-stream",
        "cache-control": cache,
      });
      createReadStream(path).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
