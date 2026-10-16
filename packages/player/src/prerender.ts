// Build-time rendering of the first screen (ADR 0012). The builder inserts this HTML into index.html so
// the first screen paints as soon as HTML and CSS arrive; main.ts then replaces it with the live player
// (no hydration: choice order, language and resume point are only known in the browser).
import { render } from "svelte/server";
import App from "./App.svelte";
import type { CompiledContent } from "./content.ts";
import { PLAYER_KEY, Player } from "./player.svelte.ts";
import { SESSION_KEY } from "./tracking/session.svelte.ts";

export function prerender(content: CompiledContent): string {
  // Default locale, first screen: what a learner without a language preference or resume point sees.
  const player = new Player(content, [content.module.defaultLocale]);
  // The prerendered page is inert: the session is never used, only provided.
  const session = { finish: () => {} };
  return render(App, {
    context: new Map<symbol, unknown>([
      [PLAYER_KEY, player],
      [SESSION_KEY, session],
    ]),
  }).body;
}
