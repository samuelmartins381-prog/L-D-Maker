import { defineConfig } from "vite";

// Main process: one ES module bundling the workspace packages (ADR 0014). Electron and pdf.js
// stay external (pdf.js is resolved at run time from node_modules, see generator/readers/pdf.ts).
export default defineConfig({
  build: {
    ssr: "src/main/main.ts",
    outDir: "dist/main",
    emptyOutDir: true,
    target: "node24",
    rollupOptions: {
      external: ["electron", /^pdfjs-dist/],
      output: { format: "es", entryFileNames: "main.js" },
    },
  },
  ssr: { noExternal: true },
});
