import { type Browser, chromium, type Page } from "playwright-core";

export const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export function launch(): Promise<Browser> {
  return chromium.launch({ executablePath: CHROMIUM_PATH });
}

/** Opens a fresh context (empty storage, so no resume) with the given viewport and motion preference. */
export async function openModule(
  browser: Browser,
  url: string,
  opts: {
    width: number;
    height: number;
    reducedMotion?: "reduce" | "no-preference";
  },
): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    reducedMotion: opts.reducedMotion ?? "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400)
      errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);
  });
  await page.goto(url);
  await page.locator("h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await imagesWithMarkers(page);
  return { page, errors };
}

export async function nextScreen(page: Page): Promise<void> {
  await page.locator("footer.pager .primary").click();
  await page.locator("h1").waitFor();
  await imagesWithMarkers(page);
}

/** Markers stay hidden until their image has loaded: audit what the learner then sees. */
async function imagesWithMarkers(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLImageElement>(".stage img")].every(
      (i) => i.complete,
    ),
  );
}

/** Puts a screen in its "interacted" state: every accordion panel and hotspot opened, every question answered to its final state. */
export async function interact(page: Page): Promise<void> {
  // The set of closed panels shrinks after each click: always open the first remaining one.
  const closed = page.locator('.accordion button[aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
  // Hotspots: open every marker in turn (the last one stays open).
  for (const marker of await page.locator(".hotspots .marker").all())
    await marker.click();
  for (const form of await page.locator("form.question").all()) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const submit = form.locator('button[type="submit"]');
      if ((await submit.count()) === 0) break;
      // Sequence: move one step down, then submit, until the question is final.
      const down = form.locator(
        '.steps button[data-move="down"]:not([disabled])',
      );
      if ((await down.count()) > 0) {
        await down.first().click();
        if (!(await submit.isDisabled())) await submit.click();
        continue;
      }
      const inputs = await form.locator("input:not([disabled])").all();
      const input = inputs[attempt % inputs.length];
      if (!input) break;
      // Element clicks, not pointer clicks: unchecking a box after a wrong attempt removes the
      // explanations and shifts the layout, and a pointer click at the old position could land on
      // the neighbouring box. The goal here is to reach the answered state, not to test pointing.
      const click = (el: typeof input) =>
        el.evaluate((e) => (e as HTMLInputElement).click());
      if ((await input.getAttribute("type")) === "checkbox")
        for (const other of inputs)
          if (other !== input && (await other.isChecked())) await click(other);
      if (!(await input.isChecked())) await click(input);
      if (await submit.isDisabled()) continue;
      await submit.click();
    }
  }
}

/** Opens the first zoomable image of the screen and zooms in once; false when there is none. */
export async function openZoom(page: Page): Promise<boolean> {
  const button = page.locator("figure button.open").first();
  if ((await button.count()) === 0) return false;
  await button.click();
  await page.locator("dialog.zoom[open] .viewport img").waitFor();
  await page.keyboard.press("+");
  return true;
}

export async function closeZoom(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.locator("dialog.zoom[open]").waitFor({ state: "detached" });
}
