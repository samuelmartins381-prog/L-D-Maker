import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// The player ships as one classic script (IIFE) + one stylesheet + font files, loadable from
// file:// (ADR 0003). The builder reads dist/.vite/manifest.json to find the hashed file names.
export default defineConfig({
  plugins: [svelte()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    manifest: true,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: "src/main.ts",
      output: {
        format: "iife",
        entryFileNames: "player-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
