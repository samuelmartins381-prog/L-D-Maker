import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/noto-sans-arabic";
import "./themes/lumiere.css";
import "./base.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { CONTENT_ELEMENT_ID } from "./content.js";
import { PLAYER_KEY, Player } from "./player.svelte.js";

const raw = document.getElementById(CONTENT_ELEMENT_ID)?.textContent;
if (!raw) throw new Error(`#${CONTENT_ELEMENT_ID} is missing`);
const content = JSON.parse(raw);
const requested = [
  new URLSearchParams(location.search).get("lang"),
  ...navigator.languages,
];
const player = new Player(content, requested);
const target = document.getElementById("ldm-app") ?? document.body;
mount(App, { target, context: new Map([[PLAYER_KEY, player]]) });
