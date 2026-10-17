import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// The interface: a static page loaded from disk by the main process.
export default defineConfig({
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
