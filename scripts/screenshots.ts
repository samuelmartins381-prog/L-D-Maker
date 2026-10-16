// Captures a built module in several locales and viewports (visual check; becomes part of QA in step 6).
// Usage: node scripts/screenshots.ts <web-dir> <out-dir> [screenIndex...]
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const [webDir, outDir, ...screenArgs] = process.argv.slice(2);
if (!webDir || !outDir)
  throw new Error("usage: screenshots.ts <web-dir> <out-dir> [screenIndex...]");
const screens = screenArgs.length ? screenArgs.map(Number) : [0];
const viewports = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};
// LOCALES=ja,zh-Hans,ko node scripts/screenshots.ts … to capture other languages.
const locales = process.env.LOCALES?.split(",") ?? ["fr", "en", "ar"];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors: string[] = [];
for (const [name, viewport] of Object.entries(viewports)) {
  for (const locale of locales) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => errors.push(`${locale}/${name}: ${e.message}`));
    page.on(
      "console",
      (m) =>
        m.type() === "error" && errors.push(`${locale}/${name}: ${m.text()}`),
    );
    await page.goto(`file://${resolve(webDir, "index.html")}?lang=${locale}`);
    await page.locator("h1").waitFor(); // other locales are loaded before the first render
    await page.evaluate(() => document.fonts.ready);
    let current = 0;
    for (const target of screens) {
      while (current < target) {
        await page.locator("footer.pager .primary").click();
        current++;
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${outDir}/${locale}-${name}-s${target}.png`,
        fullPage: name === "mobile",
      });
    }
    await page.close();
  }
}
await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`screenshots written to ${outDir}`);
