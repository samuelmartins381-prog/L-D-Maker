import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// The player ships as one classic script (IIFE) + one stylesheet + font files, loadable from
// file:// (ADR 0003). The builder reads dist/.vite/manifest.json to find the hashed file names.
// A second build (--ssr) produces dist-ssr/prerender.js, an ES module the builder runs in Node to
// render the first screen into index.html (ADR 0012).
export default defineConfig(({ isSsrBuild }) =>
  isSsrBuild
    ? {
        plugins: [svelte()],
        build: {
          outDir: "dist-ssr",
          emptyOutDir: true,
          target: "node22",
          rollupOptions: {
            output: { format: "es", entryFileNames: "prerender.js" },
          },
        },
      }
    : {
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
      },
);
