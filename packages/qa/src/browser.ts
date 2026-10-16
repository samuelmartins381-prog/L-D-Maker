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
  return { page, errors };
}

export async function nextScreen(page: Page): Promise<void> {
  await page.locator("footer.pager .primary").click();
  await page.locator("h1").waitFor();
}

/** Puts a screen in its "interacted" state: every accordion panel open, every question answered to its final state. */
export async function interact(page: Page): Promise<void> {
  // The set of closed panels shrinks after each click: always open the first remaining one.
  const closed = page.locator('.accordion button[aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
  for (const form of await page.locator("form.question").all()) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const submit = form.locator('button[type="submit"]');
      if ((await submit.count()) === 0) break;
      const inputs = await form.locator("input:not([disabled])").all();
      const input = inputs[attempt % inputs.length];
      if (!input) break;
      if ((await input.getAttribute("type")) === "checkbox")
        for (const other of inputs)
          if (other !== input && (await other.isChecked()))
            await other.uncheck();
      await input.check();
      if (await submit.isDisabled()) continue;
      await submit.click();
    }
  }
}
