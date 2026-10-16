// Inline <head> script that hides the prerendered first screen (ADR 0012) when the browser already
// tells us the live player will show something else: another locale (URL or browser languages) or, for
// the HTML5 target, a saved resume point. It runs before the first paint, so no wrong-language flash.
// The negotiation mirrors negotiateLocale (player/src/locale.ts); prerender-guard.test.ts keeps them in sync.

/** Class set on <html> while the prerender must stay hidden. */
export const WAIT_CLASS = "ldm-wait";

export const guardStyle = `html.${WAIT_CLASS} #ldm-app[data-prerender]{visibility:hidden}`;

const NEGOTIATE = `function(av,fb,rq){var i,j,L=function(x){return x.split("-")[0].toLowerCase()};for(i=0;i<rq.length;i++)for(j=0;j<av.length;j++)if(av[j].toLowerCase()===rq[i].toLowerCase())return av[j];for(i=0;i<rq.length;i++)for(j=0;j<av.length;j++)if(L(av[j])===L(rq[i]))return av[j];return fb}`;

/** `storageKey`: the HTML5 target's resume key (ldm:<id>@<version>), null for LMS targets. */
export function guardScript(
  locales: readonly string[],
  defaultLocale: string,
  storageKey: string | null,
): string {
  const args = [locales, defaultLocale, storageKey]
    .map((a) => JSON.stringify(a).replace(/</g, "\\u003c"))
    .join(",");
  return `(function(av,fb,key){try{var n=(${NEGOTIATE});var rq=[new URLSearchParams(location.search).get("lang")].concat(navigator.languages||[]).filter(Boolean);if(n(av,fb,rq)!==fb||(key&&localStorage.getItem(key)))document.documentElement.classList.add(${JSON.stringify(WAIT_CLASS)})}catch(e){}})(${args});`;
}
