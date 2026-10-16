import type { z } from "zod";
import {
  type Block,
  Module,
  type StringCatalog,
  StringCatalog as StringCatalogSchema,
} from "./schema.ts";

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  code: string;
  /** Location, e.g. "module.yaml: sections[0].screens[1].blocks[0].choices" or "strings/ar.json". */
  path: string;
  message: string;
}

export interface ModuleSource {
  /** Parsed module.yaml (unknown shape until validated). */
  module: unknown;
  /** Parsed strings/<locale>.json, keyed by locale. */
  strings: Record<string, unknown>;
  /** Paths (relative to the module folder) of files present under media/. */
  mediaFiles: readonly string[];
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  /** Set when the structure is valid, so later stages can use the typed module. */
  module?: Module;
}

/** Below this distance (in % of the image), two markers overlap on a phone-width image. */
const HOTSPOT_MIN_DISTANCE = 7;

function zodIssues(file: string, error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({
    severity: "error",
    code: "schema",
    path: `${file}: ${i.path.map(String).join(".") || "(root)"}`,
    message: i.message,
  }));
}

/** A string key referenced by the module, with where it is used (for error messages). */
export interface KeyRef {
  key: string;
  at: string;
}

function blockKeys(block: Block, at: string): KeyRef[] {
  const refs: KeyRef[] = [];
  const add = (key: string | undefined, field: string) => {
    if (key) refs.push({ key, at: `${at}.${field}` });
  };
  add(block.heading, "heading");
  switch (block.type) {
    case "narrative":
      add(block.body, "body");
      if (block.media?.kind === "image") add(block.media.alt, "media.alt");
      break;
    case "accordion":
    case "tabs":
      add(block.intro, "intro");
      block.items.forEach((item, i) => {
        add(item.title, `items[${i}].title`);
        add(item.body, `items[${i}].body`);
      });
      break;
    case "hotspots":
      add(block.intro, "intro");
      add(block.image.alt, "image.alt");
      block.items.forEach((item, i) => {
        add(item.title, `items[${i}].title`);
        add(item.body, `items[${i}].body`);
      });
      break;
    case "question":
      add(block.prompt, "prompt");
      add(block.image?.alt, "image.alt");
      block.choices.forEach((c, i) => {
        add(c.text, `choices[${i}].text`);
        add(c.feedback, `choices[${i}].feedback`);
      });
      break;
    case "summary":
      for (const [i, p] of block.points.entries()) add(p, `points[${i}]`);
      break;
  }
  return refs;
}

/** Every string key the module references, in reading order, with where it is used. */
export function collectKeys(m: Module): KeyRef[] {
  const refs: KeyRef[] = [
    { key: m.meta.title, at: "meta.title" },
    { key: m.meta.description, at: "meta.description" },
    ...m.objectives.map((o, i) => ({
      key: o.text,
      at: `objectives[${i}].text`,
    })),
  ];
  m.sections.forEach((s, si) => {
    refs.push({ key: s.title, at: `sections[${si}].title` });
    s.screens.forEach((sc, sci) => {
      const at = `sections[${si}].screens[${sci}]`;
      refs.push({ key: sc.title, at: `${at}.title` });
      sc.blocks.forEach((b, bi) => {
        refs.push(...blockKeys(b, `${at}.blocks[${bi}]`));
      });
    });
  });
  return refs;
}

function checkSemantics(
  m: Module,
  catalogs: Record<string, StringCatalog>,
  presentLocales: Set<string>,
  mediaFiles: Set<string>,
): Issue[] {
  const issues: Issue[] = [];
  const err = (code: string, path: string, message: string) =>
    issues.push({
      severity: "error",
      code,
      path: `module.yaml: ${path}`,
      message,
    });
  const warn = (code: string, path: string, message: string) =>
    issues.push({ severity: "warning", code, path, message });
  const warnOverlaps = (
    markers: readonly { id: string; x: number; y: number }[],
    path: string,
  ) =>
    markers.forEach((a, i) => {
      for (const c of markers.slice(i + 1)) {
        if (Math.hypot(a.x - c.x, a.y - c.y) < HOTSPOT_MIN_DISTANCE)
          warn(
            "hotspot-overlap",
            path,
            `markers "${a.id}" and "${c.id}" are closer than ${HOTSPOT_MIN_DISTANCE} % and may overlap on a phone`,
          );
      }
    });

  // Unique ids across the whole module: they become tracking and bookmark identifiers.
  const seen = new Map<string, string>();
  const claim = (id: string, at: string) => {
    const prev = seen.get(id);
    if (prev) err("duplicate-id", at, `id "${id}" already used at ${prev}`);
    else seen.set(id, at);
  };
  for (const [i, o] of m.objectives.entries()) claim(o.id, `objectives[${i}]`);
  const objectiveIds = new Set(m.objectives.map((o) => o.id));
  const assessed = new Set<string>();
  /** Objectives with at least one scored question a screen reader user can answer (not hotspot). */
  const assessedInText = new Set<string>();

  if (new Set(m.locales).size !== m.locales.length)
    err("duplicate-locale", "locales", "locale listed twice");

  m.sections.forEach((s, si) => {
    claim(s.id, `sections[${si}]`);
    s.screens.forEach((sc, sci) => {
      claim(sc.id, `sections[${si}].screens[${sci}]`);
      sc.blocks.forEach((b, bi) => {
        const at = `sections[${si}].screens[${sci}].blocks[${bi}]`;
        claim(b.id, at);
        if (b.type === "narrative" && b.media?.kind === "image") {
          if (!b.media.alt && !b.media.decorative)
            err(
              "image-alt",
              `${at}.media`,
              "image needs alt text, or decorative: true",
            );
          if (!mediaFiles.has(b.media.src))
            err(
              "media-missing",
              `${at}.media.src`,
              `file not found: ${b.media.src}`,
            );
          if (b.media.zoomSrc && !mediaFiles.has(b.media.zoomSrc))
            err(
              "media-missing",
              `${at}.media.zoomSrc`,
              `file not found: ${b.media.zoomSrc}`,
            );
          if (b.media.zoomSrc && !b.media.zoom)
            err("zoom", `${at}.media.zoomSrc`, "zoomSrc requires zoom: true");
          if (b.media.zoom && b.media.decorative)
            err(
              "zoom",
              `${at}.media.zoom`,
              "a decorative image cannot be zoomable: give it alt text instead",
            );
        }
        if (b.type === "hotspots") {
          if (!mediaFiles.has(b.image.src))
            err(
              "media-missing",
              `${at}.image.src`,
              `file not found: ${b.image.src}`,
            );
          warnOverlaps(b.items, `module.yaml: ${at}.items`);
        }
        if (
          (b.type === "accordion" ||
            b.type === "tabs" ||
            b.type === "hotspots") &&
          new Set(b.items.map((x) => x.id)).size !== b.items.length
        )
          err(
            "duplicate-id",
            `${at}.items`,
            "item ids must be unique within the block",
          );
        if (b.type === "question") {
          const correct = b.choices.filter((c) => c.correct).length;
          if (new Set(b.choices.map((c) => c.id)).size !== b.choices.length)
            err(
              "duplicate-id",
              `${at}.choices`,
              "choice ids must be unique within the question",
            );
          if (b.variant === "hotspot") {
            if (!b.image) err("hotspot", at, "hotspot question needs an image");
            else if (!mediaFiles.has(b.image.src))
              err(
                "media-missing",
                `${at}.image.src`,
                `file not found: ${b.image.src}`,
              );
            b.choices.forEach((c, i) => {
              if (c.x === undefined || c.y === undefined)
                err(
                  "hotspot",
                  `${at}.choices[${i}]`,
                  "hotspot choice needs x and y",
                );
            });
            warnOverlaps(
              b.choices.filter(
                (c): c is typeof c & { x: number; y: number } =>
                  c.x !== undefined && c.y !== undefined,
              ),
              `module.yaml: ${at}.choices`,
            );
          } else if (
            b.image ||
            b.choices.some((c) => c.x !== undefined || c.y !== undefined)
          )
            err(
              "hotspot",
              at,
              "image and x/y positions are only for the hotspot variant",
            );
          if (b.variant !== "multiple" && correct !== 1)
            err(
              "answer-key",
              `${at}.choices`,
              `${b.variant} question needs exactly 1 correct choice, found ${correct}`,
            );
          if (
            b.variant === "multiple" &&
            (correct < 1 || correct === b.choices.length)
          )
            err(
              "answer-key",
              `${at}.choices`,
              "multiple-choice question needs at least 1 correct and 1 incorrect choice",
            );
          for (const o of b.objectives) {
            if (!objectiveIds.has(o))
              err(
                "unknown-objective",
                `${at}.objectives`,
                `unknown objective "${o}"`,
              );
            else if (b.scored) {
              assessed.add(o);
              if (b.variant !== "hotspot") assessedInText.add(o);
            }
          }
          if (b.scored && b.objectives.length === 0)
            err(
              "alignment",
              `${at}.objectives`,
              "scored question must reference at least one objective",
            );
        }
      });
    });
  });

  // Alignment objectives ↔ assessment (brief §4, pedagogy).
  m.objectives.forEach((o, i) => {
    if (!assessed.has(o.id))
      err(
        "alignment",
        `objectives[${i}]`,
        `objective "${o.id}" is not assessed by any scored question`,
      );
    // A hotspot question is visual by nature (WCAG 1.1.1 test exception): blind learners need
    // another way to show the same objective (ADR 0010).
    else if (!assessedInText.has(o.id))
      warn(
        "visual-only-assessment",
        `module.yaml: objectives[${i}]`,
        `objective "${o.id}" is only assessed by hotspot questions: add a scored text question so every learner can pass it`,
      );
  });
  const scoredCount = m.sections
    .flatMap((s) => s.screens.flatMap((sc) => sc.blocks))
    .filter((b) => b.type === "question" && b.scored).length;
  // With too few scored items, a single mistake fails the learner (e.g. 3 items at 80 % need 3/3).
  const tolerated =
    scoredCount - Math.ceil((scoredCount * m.assessment.passingScore) / 100);
  if (scoredCount > 0 && m.assessment.passingScore > 0 && tolerated < 1)
    warn(
      "assessment-tolerance",
      "module.yaml: assessment.passingScore",
      `${scoredCount} scored question(s) at ${m.assessment.passingScore} %: a single mistake fails the module; add questions or lower the threshold`,
    );
  if (m.assessment.completion === "all-screens-and-passed" && scoredCount === 0)
    err(
      "assessment",
      "assessment.completion",
      "completion requires passing, but the module has no scored question",
    );

  // Every referenced key must exist and be non-empty in every locale; unused keys are flagged.
  const refs = collectKeys(m);
  const used = new Set(refs.map((r) => r.key));
  for (const locale of m.locales) {
    const file = `strings/${locale}.json`;
    const catalog = catalogs[locale];
    if (!catalog) {
      // A catalog that exists but failed to parse is already reported as a schema error.
      if (!presentLocales.has(locale))
        issues.push({
          severity: "error",
          code: "missing-catalog",
          path: file,
          message: "catalog file is missing",
        });
      continue;
    }
    for (const { key, at } of refs) {
      const value = catalog[key];
      if (value === undefined)
        issues.push({
          severity: "error",
          code: "missing-string",
          path: file,
          message: `missing key "${key}" (${at})`,
        });
      else if (value.trim() === "")
        issues.push({
          severity: "error",
          code: "empty-string",
          path: file,
          message: `empty value for "${key}"`,
        });
    }
    for (const key of Object.keys(catalog)) {
      if (!used.has(key))
        warn("unused-string", file, `key "${key}" is not used by module.yaml`);
    }
  }
  for (const locale of presentLocales) {
    if (!m.locales.includes(locale))
      warn(
        "unlisted-catalog",
        `strings/${locale}.json`,
        `locale "${locale}" is not listed in module.yaml locales`,
      );
  }
  return issues;
}

/** Validates a module: structure first, then cross-references, pedagogy and translations. */
export function validateModule(source: ModuleSource): ValidationResult {
  const parsed = Module.safeParse(source.module);
  const catalogs: Record<string, StringCatalog> = {};
  const issues: Issue[] = [];
  for (const [locale, raw] of Object.entries(source.strings)) {
    const c = StringCatalogSchema.safeParse(raw);
    if (c.success) catalogs[locale] = c.data;
    else issues.push(...zodIssues(`strings/${locale}.json`, c.error));
  }
  if (!parsed.success) {
    issues.push(...zodIssues("module.yaml", parsed.error));
    return { ok: false, issues };
  }
  issues.push(
    ...checkSemantics(
      parsed.data,
      catalogs,
      new Set(Object.keys(source.strings)),
      new Set(source.mediaFiles),
    ),
  );
  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
    module: parsed.data,
  };
}
