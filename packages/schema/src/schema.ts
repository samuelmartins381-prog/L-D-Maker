import { z } from "zod";

/** Version of the module format implemented by this package (see ADR 0002). */
export const SCHEMA_VERSION = "0.1";

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STRING_KEY = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
// BCP 47 subset we accept: language, optional script, optional region (fr, en-GB, zh-Hans, zh-Hant-TW).
const LOCALE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/;
const MEDIA_PATH = /^media\/[A-Za-z0-9._\-/]+$/;

export const Id = z.string().regex(ID, "lowercase kebab-case id expected");
/** Reference to an entry of the string catalogs (strings/<locale>.json). Never displayed text. */
export const StringKey = z
  .string()
  .regex(STRING_KEY, "string key expected, e.g. s1.intro.body");
export const Locale = z
  .string()
  .regex(LOCALE, "BCP 47 locale expected, e.g. fr, en-GB, zh-Hans");

const MediaSrc = z.string().regex(MEDIA_PATH, "path under media/ expected");

export const Image = z.strictObject({
  kind: z.literal("image"),
  src: MediaSrc,
  /** Required unless the image is purely decorative. */
  alt: StringKey.optional(),
  decorative: z.boolean().default(false),
});

export const Media = z.discriminatedUnion("kind", [Image]);

const blockBase = {
  id: Id,
  heading: StringKey.optional(),
};

export const Narrative = z.strictObject({
  ...blockBase,
  type: z.literal("narrative"),
  body: StringKey,
  media: Media.optional(),
  layout: z
    .enum(["text", "media-start", "media-end", "media-top"])
    .default("text"),
});

const Panel = z.strictObject({
  id: Id,
  title: StringKey,
  body: StringKey,
});

export const Accordion = z.strictObject({
  ...blockBase,
  type: z.literal("accordion"),
  intro: StringKey.optional(),
  items: z.array(Panel).min(2),
});

export const Tabs = z.strictObject({
  ...blockBase,
  type: z.literal("tabs"),
  intro: StringKey.optional(),
  items: z.array(Panel).min(2).max(6),
});

const Hotspot = z.strictObject({
  id: Id,
  /**
   * Marker position in % of the image width and height, from its top-left corner. Image
   * coordinates are physical: they are not mirrored in right-to-left languages.
   */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  title: StringKey,
  body: StringKey,
});

/** An image with numbered markers, each revealing an explanation (a part, a zone, a detail). */
export const Hotspots = z.strictObject({
  ...blockBase,
  type: z.literal("hotspots"),
  intro: StringKey.optional(),
  /** The image carries meaning, so its description is required. */
  image: z.strictObject({ src: MediaSrc, alt: StringKey }),
  items: z.array(Hotspot).min(2).max(12),
});

const Choice = z.strictObject({
  id: Id,
  text: StringKey,
  correct: z.boolean(),
  /**
   * Explanation of this option (brief §4: feedback per answer), written neutrally — it is shown
   * whether or not the learner picked the option. The player displays the right/wrong verdict.
   */
  feedback: StringKey,
});

export const Question = z.strictObject({
  ...blockBase,
  type: z.literal("question"),
  variant: z.enum(["single", "multiple"]),
  prompt: StringKey,
  choices: z.array(Choice).min(2).max(8),
  /** Learning objectives this question provides evidence for. */
  objectives: z.array(Id).default([]),
  /** Scored questions count toward the module score; unscored ones are practice. */
  scored: z.boolean().default(true),
  attempts: z.int().min(1).max(5).default(1),
  shuffle: z.boolean().default(true),
});

export const Summary = z.strictObject({
  ...blockBase,
  type: z.literal("summary"),
  points: z.array(StringKey).min(1),
});

export const Block = z.discriminatedUnion("type", [
  Narrative,
  Accordion,
  Tabs,
  Hotspots,
  Question,
  Summary,
]);

export const Screen = z.strictObject({
  id: Id,
  title: StringKey,
  blocks: z.array(Block).min(1),
});

export const Section = z.strictObject({
  id: Id,
  title: StringKey,
  screens: z.array(Screen).min(1),
});

export const Objective = z.strictObject({
  id: Id,
  /** Revised Bloom taxonomy level; drives the choice of activities and assessment. */
  bloom: z.enum([
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
  ]),
  text: StringKey,
});

export const Module = z
  .strictObject({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id: Id,
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "semver expected, e.g. 1.0.0"),
    defaultLocale: Locale,
    locales: z.array(Locale).min(1),
    meta: z.strictObject({
      title: StringKey,
      description: StringKey,
      durationMinutes: z.int().min(1).max(600),
    }),
    objectives: z.array(Objective).min(1),
    assessment: z.strictObject({
      /** Percentage of scored points required to pass. */
      passingScore: z.int().min(0).max(100),
      completion: z
        .enum(["all-screens", "all-screens-and-passed"])
        .default("all-screens"),
    }),
    sections: z.array(Section).min(1),
  })
  .refine((m) => m.locales.includes(m.defaultLocale), {
    message: "defaultLocale must be listed in locales",
    path: ["defaultLocale"],
  });

/** Flat catalog of translated strings for one locale. */
export const StringCatalog = z.record(StringKey, z.string());

export type Module = z.infer<typeof Module>;
export type Section = z.infer<typeof Section>;
export type Screen = z.infer<typeof Screen>;
export type Block = z.infer<typeof Block>;
export type Question = z.infer<typeof Question>;
export type Objective = z.infer<typeof Objective>;
export type StringCatalog = z.infer<typeof StringCatalog>;
