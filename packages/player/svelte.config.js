import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  // ADR 0003: compiler warnings (accessibility included) fail the build.
  onwarn(warning) {
    throw new Error(
      `[svelte] ${warning.code}: ${warning.message} (${warning.filename}:${warning.start?.line})`,
    );
  },
};
