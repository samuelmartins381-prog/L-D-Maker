import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

// The interface's own errors go to the diagnostic journal, where Sam can find them.
window.addEventListener("error", (e) => {
  void window.ldm.log(`${e.message} at ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  void window.ldm.log(`unhandled: ${(e.reason as Error)?.stack ?? e.reason}`);
});

mount(App, { target: document.getElementById("app") as HTMLElement });
