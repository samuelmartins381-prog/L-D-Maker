import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/noto-sans-arabic";
import "./themes/lumiere.css";
import "./base.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { CONTENT_ELEMENT_ID, type CompiledContent } from "./content.ts";
import { PLAYER_KEY, Player } from "./player.svelte.ts";
import { findScorm12Api, Scorm12Tracker } from "./tracking/scorm12.ts";
import { findScorm2004Api, Scorm2004Tracker } from "./tracking/scorm2004.ts";
import { SESSION_KEY, Session } from "./tracking/session.svelte.ts";
import { StandaloneTracker } from "./tracking/standalone.ts";
import type { Tracker } from "./tracking/tracker.ts";

const raw = document.getElementById(CONTENT_ELEMENT_ID)?.textContent;
if (!raw) throw new Error(`#${CONTENT_ELEMENT_ID} is missing`);
const content = JSON.parse(raw) as CompiledContent;
const { module } = content;

function createTracker(): Tracker {
  if (content.target === "scorm2004") {
    const api = findScorm2004Api();
    if (api) return new Scorm2004Tracker(api);
    console.warn(
      "[ldm] SCORM 2004 API not found: running standalone (preview outside an LMS)",
    );
  }
  if (content.target === "scorm12") {
    const api = findScorm12Api();
    if (api) return new Scorm12Tracker(api);
    console.warn(
      "[ldm] SCORM 1.2 API not found: running standalone (preview outside an LMS)",
    );
  }
  return new StandaloneTracker(`${module.id}@${module.version}`);
}

// Language: explicit URL parameter, then the LMS learner preference, then the browser.
const tracker = createTracker();
const start = tracker.start();
const requested = [
  new URLSearchParams(location.search).get("lang"),
  start.language,
  ...navigator.languages,
];
const player = new Player(content, requested);
const session = new Session(player, tracker, start);
const target = document.getElementById("ldm-app") ?? document.body;

mount(App, {
  target,
  context: new Map<symbol, unknown>([
    [PLAYER_KEY, player],
    [SESSION_KEY, session],
  ]),
});
