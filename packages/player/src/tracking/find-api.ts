// Finds the LMS run-time API object (SCORM 1.2: window.API, SCORM 2004: window.API_1484_11) in this
// window, its parents, then the opener and its parents (LMS that open the SCO in a popup).
const MAX_HOPS = 10;

function apiIn<T>(
  win: Window,
  name: string,
  isApi: (x: unknown) => x is T,
): T | null {
  try {
    const api = (win as unknown as Record<string, unknown>)[name];
    return isApi(api) ? api : null;
  } catch {
    // Cross-origin frame (e.g. SAP SuccessFactors header, KBA 2808684): skip it and keep climbing.
    return null;
  }
}

export function findApi<T>(
  name: string,
  isApi: (x: unknown) => x is T,
  start: Window = window,
): T | null {
  const climb = (from: Window | null): T | null => {
    let win = from;
    for (let hops = 0; win && hops <= MAX_HOPS; hops++) {
      const api = apiIn(win, name, isApi);
      if (api) return api;
      let parent: Window | null = null;
      try {
        parent = win.parent;
      } catch {
        parent = null;
      }
      if (!parent || parent === win) break;
      win = parent;
    }
    return null;
  };
  let opener: Window | null = null;
  try {
    opener = start.top?.opener ?? start.opener ?? null;
  } catch {
    opener = null;
  }
  return climb(start) ?? climb(opener);
}
