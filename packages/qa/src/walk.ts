// Visits every screen of a built module in every locale and viewport, in two states (as shown,
// then after interaction), and collects raw findings for the accessibility and layout checks.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Browser, Page } from "playwright-core";
import { interact, nextScreen, openModule } from "./browser.ts";
import { VIEWPORTS, type Viewport } from "./types.ts";

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
/** WCAG 2.0 / 2.1 / 2.2, levels A and AA (brief §5: WCAG 2.2 AA minimum). */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export interface Where {
  locale: string;
  viewport: Viewport["name"];
  screen: number;
  state: "initial" | "interacted";
}

export interface AxeViolation extends Where {
  rule: string;
  impact: string;
  help: string;
  targets: string[];
}

export interface KeyboardIssue extends Where {
  kind:
    | "no-visible-focus"
    | "obscured"
    | "partly-obscured"
    | "unreachable"
    | "trap";
  element: string;
}

export interface WalkResult {
  screens: number;
  pagesAudited: number;
  axe: AxeViolation[];
  keyboard: KeyboardIssue[];
  focusStops: number;
  overflow: (Where & { scrollWidth: number; width: number })[];
  motion: (Where & { element: string; duration: string })[];
  errors: string[];
  screenshots: string[];
}

async function runAxe(page: Page, where: Where): Promise<AxeViolation[]> {
  if (!(await page.evaluate(() => "axe" in window)))
    await page.addScriptTag({ content: AXE_SOURCE });
  const violations = await page.evaluate(async (tags) => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            ctx: Document,
            opts: object,
          ) => Promise<{
            violations: {
              id: string;
              impact: string;
              help: string;
              nodes: { target: string[] }[];
            }[];
          }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")),
    }));
  }, AXE_TAGS);
  return violations.map((v) => ({ ...where, ...v }));
}

/** Tabs through the whole page: every stop must show a focus indicator and stay visible (WCAG 2.4.7, 2.4.11). */
async function tabWalk(
  page: Page,
  where: Where,
): Promise<{ issues: KeyboardIssue[]; stops: number }> {
  // Restart sequential navigation from the top of the document (not from the last clicked button).
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  const issues: KeyboardIssue[] = [];
  const seen = new Set<string>();
  let stops = 0;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const path: string[] = [];
      for (
        let n: Element | null = el;
        n && n !== document.body;
        n = n.parentElement
      ) {
        const index = n.parentElement
          ? [...n.parentElement.children].indexOf(n)
          : 0;
        path.unshift(`${n.tagName.toLowerCase()}:${index}`);
      }
      const s = getComputedStyle(el);
      const indicator =
        (s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) >= 2) ||
        s.boxShadow !== "none";
      // Occlusion as the learner sees it: is the element painted on top at sample points?
      const r = el.getBoundingClientRect();
      // Centre and four points a quarter in: corners would miss rounded shapes (hit testing follows border-radius).
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const points = [
        [cx, cy],
        [r.left + r.width / 4, cy],
        [r.right - r.width / 4, cy],
        [cx, r.top + r.height / 4],
        [cx, r.bottom - r.height / 4],
      ];
      const visible = points.map(([x, y]) => {
        const hit = document.elementFromPoint(x as number, y as number);
        return (
          !!hit &&
          (hit === el ||
            el.contains(hit) ||
            (el as HTMLInputElement).labels?.[0]?.contains(hit) === true)
        );
      });
      const label = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} « ${(el.textContent || el.getAttribute("aria-label") || el.getAttribute("value") || "").trim().slice(0, 40)} »`;
      return {
        key: path.join("/"),
        label,
        indicator,
        hidden: visible.every((v) => !v),
        partly: visible.some((v) => !v),
      };
    });
    if (!info) break; // focus left the document: the tab cycle is complete
    if (seen.has(info.key)) break;
    seen.add(info.key);
    stops++;
    if (!info.indicator)
      issues.push({ ...where, kind: "no-visible-focus", element: info.label });
    if (info.hidden)
      issues.push({ ...where, kind: "obscured", element: info.label });
    else if (info.partly)
      issues.push({ ...where, kind: "partly-obscured", element: info.label });
    if (i === 119) issues.push({ ...where, kind: "trap", element: info.label });
  }
  // Every visible, enabled control must have been reached (one stop per radio group).
  const unreached = await page.evaluate((reachedCount) => {
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        // tabindex="-1" marks controls deliberately out of the Tab sequence (APG roving tabindex: tabs use arrows).
        "a[href], button:not([disabled]):not([tabindex='-1']), input:not([disabled]):not([tabindex='-1']), select, [tabindex='0']",
      ),
    ]
      .filter(
        (el) =>
          el.getClientRects().length > 0 && !el.closest("[inert], [hidden]"),
      )
      .filter(
        (el, _, all) =>
          !(
            el instanceof HTMLInputElement &&
            el.type === "radio" &&
            all.find(
              (o) =>
                o instanceof HTMLInputElement &&
                o.type === "radio" &&
                o.name === el.name,
            ) !== el
          ),
      );
    return controls.length > reachedCount
      ? controls.map(
          (el) =>
            `${el.tagName.toLowerCase()} « ${(el.textContent || el.getAttribute("value") || "").trim().slice(0, 40)} »`,
        )
      : [];
  }, stops);
  if (unreached.length)
    issues.push({
      ...where,
      kind: "unreachable",
      element: `${unreached.length} contrôles visibles pour ${stops} arrêts de tabulation`,
    });
  return { issues, stops };
}

async function overflow(page: Page, where: Where) {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  return m.scrollWidth > m.width + 1 ? [{ ...where, ...m }] : [];
}

async function motion(page: Page, where: Where) {
  return (
    await page.evaluate(() =>
      [...document.querySelectorAll("*")].flatMap((el) => {
        const s = getComputedStyle(el);
        const longest = (v: string) =>
          Math.max(
            ...v
              .split(",")
              .map(
                (d) =>
                  Number.parseFloat(d) * (d.trim().endsWith("ms") ? 0.001 : 1),
              ),
          );
        const t = longest(s.transitionDuration);
        const a = s.animationName !== "none" ? longest(s.animationDuration) : 0;
        return t > 0.01 || a > 0.01
          ? [
              {
                element:
                  el.tagName.toLowerCase() +
                  (el.className
                    ? `.${String(el.className).split(" ")[0]}`
                    : ""),
                duration: `${Math.max(t, a)}s`,
              },
            ]
          : [];
      }),
    )
  ).map((m) => ({ ...where, ...m }));
}

async function screenshot(page: Page, file: string): Promise<void> {
  // Sticky bars would be painted over the content in a full-page capture: unstick them for the shot.
  await page.addStyleTag({
    content: "header.topbar, footer.pager { position: static !important; }",
  });
  await page.screenshot({ path: file, fullPage: true });
  await page.evaluate(() =>
    document.querySelector("style:last-of-type")?.remove(),
  );
}

export async function walkModule(
  browser: Browser,
  url: (locale: string) => string,
  locales: readonly string[],
  screens: number,
  screenshotDir: string,
): Promise<WalkResult> {
  const result: WalkResult = {
    screens,
    pagesAudited: 0,
    axe: [],
    keyboard: [],
    focusStops: 0,
    overflow: [],
    motion: [],
    errors: [],
    screenshots: [],
  };
  for (const viewport of VIEWPORTS) {
    for (const locale of locales) {
      const { page, errors } = await openModule(browser, url(locale), viewport);
      for (let screen = 0; screen < screens; screen++) {
        if (screen > 0) await nextScreen(page);
        for (const state of ["initial", "interacted"] as const) {
          const where: Where = {
            locale,
            viewport: viewport.name,
            screen,
            state,
          };
          if (state === "interacted") await interact(page);
          result.axe.push(...(await runAxe(page, where)));
          result.overflow.push(...(await overflow(page, where)));
          const keyboard = await tabWalk(page, where);
          result.keyboard.push(...keyboard.issues);
          result.focusStops += keyboard.stops;
          result.motion.push(...(await motion(page, where)));
          result.pagesAudited++;
          if (viewport.name === "mobile" && state === "initial") {
            const file = join(
              screenshotDir,
              `${locale}-${String(screen + 1).padStart(2, "0")}.png`,
            );
            await screenshot(page, file);
            result.screenshots.push(file);
          }
        }
      }
      result.errors.push(
        ...errors.map((e) => `${locale}/${viewport.name}: ${e}`),
      );
      await page.context().close();
    }
  }
  return result;
}
