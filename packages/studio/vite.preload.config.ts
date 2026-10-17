import { defineConfig } from "vite";

// Sandboxed preloads must be CommonJS.
export default defineConfig({
  build: {
    ssr: "src/preload/preload.ts",
    outDir: "dist/preload",
    emptyOutDir: true,
    target: "node24",
    rollupOptions: {
      external: ["electron"],
      output: { format: "cjs", entryFileNames: "preload.cjs" },
    },
  },
});
