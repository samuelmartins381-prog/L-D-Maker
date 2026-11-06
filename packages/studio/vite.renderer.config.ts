import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

/** Which build this is, shown in the window: the date and the commit it was made from. */
function build(): string {
  let commit = "";
  try {
    commit = execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
    }).trim();
  } catch {
    // Not a git checkout: the date alone.
  }
  return JSON.stringify({ date: new Date().toISOString(), commit });
}

// The interface: a static page loaded from disk by the main process.
export default defineConfig({
  define: { __STUDIO_BUILD__: build() },
  root: "src/renderer",
  base: "./",
  plugins: [
    svelte({
      // Compiler warnings, accessibility included, fail the build (as in the player, ADR 0003).
      configFile: fileURLToPath(new URL("./svelte.config.js", import.meta.url)),
    }),
  ],
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    target: "chrome140",
  },
});
