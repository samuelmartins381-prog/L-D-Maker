// Minimal fake LMS for end-to-end tests: a static HTTP server over the repository and a launch page
// that hosts the scorm-again SCORM 1.2 or 2004 API (MIT, test-only) and opens the SCO in an iframe.
// Every SetValue is logged in window.__lms so tests can assert what the LMS received.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";

export const REPO_ROOT = join(import.meta.dirname, "../../..");
const ROOT = REPO_ROOT;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".xml": "application/xml",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export type ScormVersion = "1.2" | "2004";

// Same harness for both versions; only the API object and its method names differ.
const API = {
  "1.2": {
    script: "scorm12.min.js",
    ctor: "Scorm12API",
    global: "API",
    calls: ["LMSInitialize", "LMSCommit", "LMSFinish"],
    set: "LMSSetValue",
  },
  "2004": {
    script: "scorm2004.min.js",
    ctor: "Scorm2004API",
    global: "API_1484_11",
    calls: ["Initialize", "Commit", "Terminate"],
    set: "SetValue",
  },
} as const;

const launchPage = (sco: string, initial: string, version: ScormVersion) => {
  const a = API[version];
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Fake LMS</title>
<script src="/node_modules/scorm-again/dist/${a.script}"></script>
<script>
  window.__lms = { values: {}, calls: [] };
  const api = window.${a.global} = new ${a.ctor}({ autocommit: false, logLevel: 5 });
  api.loadFromFlattenedJSON(${initial});
  for (const name of ${JSON.stringify(a.calls)}) api.on(name, () => window.__lms.calls.push(name));
  api.on("${a.set}.cmi.*", (element, value) => { window.__lms.values[element] = value; });
</script></head>
<body style="margin:0"><iframe id="sco" src="${sco}" style="border:0;width:100vw;height:100vh"></iframe></body></html>`;
};

export interface FakeLms {
  url(
    sco: string,
    initial?: Record<string, string>,
    version?: ScormVersion,
  ): string;
  close(): Promise<void>;
}

export async function startFakeLms(): Promise<FakeLms> {
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/__lms") {
      const sco = url.searchParams.get("sco") ?? "";
      const initial = url.searchParams.get("initial") ?? "{}";
      const version =
        url.searchParams.get("version") === "2004" ? "2004" : "1.2";
      res.writeHead(200, { "content-type": TYPES[".html"] });
      res.end(launchPage(sco, JSON.stringify(JSON.parse(initial)), version));
      return;
    }
    const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) return void res.writeHead(403).end();
    try {
      if (!(await stat(path)).isFile()) throw new Error();
      res.writeHead(200, {
        "content-type": TYPES[extname(path)] ?? "application/octet-stream",
      });
      createReadStream(path).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    url: (sco, initial = {}, version = "1.2") =>
      `http://127.0.0.1:${port}/__lms?version=${version}&sco=${encodeURIComponent(sco)}&initial=${encodeURIComponent(JSON.stringify(initial))}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
