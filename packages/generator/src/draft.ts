// What Claude writes for a module (ADR 0015, addendum): the module structure with its texts inline,
// in the default language. Keys, locales and the fields fixed by the project or the storyboard are
// added here, by code, so that the model never has to invent or keep track of string keys.
import type {
  Block,
  Module,
  Objective,
  Question,
  StringCatalog,
} from "@ldm/schema";
import { Id } from "@ldm/schema";
import { z } from "zod";

const Text = z.string().min(1);
const Percent = z.number().min(0).max(100);

/**
 * An image: a file under media/ of the module, or one extracted from the sources
 * (ingest/media/…), which is then copied into the module.
 */
const DraftImage = z.strictObject({
  src: z.string().regex(/^(media|ingest\/media)\/[A-Za-z0-9._\-/]+$/),
  alt: Text,
});

const Panel = z.strictObject({ id: Id, title: Text, body: Text });

export const DraftBlock = z.discriminatedUnion("type", [
  z.strictObject({
    id: Id,
    type: z.literal("narrative"),
    heading: Text.optional(),
    body: Text,
    image: DraftImage.extend({ zoom: z.boolean() }).optional(),
    layout: z
      .enum(["text", "media-start", "media-end", "media-top"])
      .optional(),
  }),
  z.strictObject({
    id: Id,
    type: z.literal("accordion"),
    heading: Text.optional(),
    intro: Text.optional(),
    items: z.array(Panel).min(2),
  }),
  z.strictObject({
    id: Id,
    type: z.literal("tabs"),
    heading: Text.optional(),
    intro: Text.optional(),
    items: z.array(Panel).min(2).max(6),
  }),
  z.strictObject({
    id: Id,
    type: z.literal("hotspots"),
    heading: Text.optional(),
    intro: Text.optional(),
    image: DraftImage,
    items: z
      .array(Panel.extend({ x: Percent, y: Percent }))
      .min(2)
      .max(12),
  }),
  z.strictObject({
    id: Id,
    type: z.literal("question"),
    heading: Text.optional(),
    variant: z.enum(["single", "multiple", "hotspot", "sequence"]),
    prompt: Text,
    image: DraftImage.optional(),
    choices: z
      .array(
        z.strictObject({
          id: Id,
          text: Text,
          correct: z.boolean().optional(),
          feedback: Text,
          x: Percent.optional(),
          y: Percent.optional(),
        }),
      )
      .min(2)
      .max(8),
    objectives: z.array(Id),
    scored: z.boolean(),
    attempts: z.int().min(1).max(5),
  }),
  z.strictObject({
    id: Id,
    type: z.literal("summary"),
    heading: Text.optional(),
    points: z.array(Text).min(1),
  }),
]);

export const ModuleDraft = z.strictObject({
  title: Text,
  description: Text,
  objectives: z.array(z.strictObject({ id: Id, text: Text })).min(1),
  sections: z
    .array(
      z.strictObject({
        id: Id,
        title: Text,
        screens: z
          .array(
            z.strictObject({
              id: Id,
              title: Text,
              blocks: z.array(DraftBlock).min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  /** What Claude wants Sam to know (a missing image, a choice made…). */
  notes: z.array(Text),
});
export type ModuleDraft = z.infer<typeof ModuleDraft>;
export type DraftBlock = z.infer<typeof DraftBlock>;

/** What the project and the approved storyboard fix; Claude does not choose these. */
export interface ModuleFrame {
  id: string;
  version: string;
  defaultLocale: string;
  locales: string[];
  durationMinutes: number;
  passingScore: number;
  completion: "all-screens" | "all-screens-and-passed";
  /** Bloom level of each objective, from the storyboard. */
  bloom: Record<string, Objective["bloom"]>;
}

export interface DraftResult {
  module: Module;
  strings: StringCatalog;
  /** Source images to copy into the module: from (relative to the project) → to (under module/). */
  copies: { from: string; to: string }[];
}

export class DraftError extends Error {}

/** Module and default-language catalogue from a draft, with keys derived from the (unique) ids. */
export function draftToModule(d: ModuleDraft, frame: ModuleFrame): DraftResult {
  const strings: StringCatalog = {};
  const copies: DraftResult["copies"] = [];
  const put = (key: string, text: string): string => {
    if (key in strings)
      throw new DraftError(`two texts would share the key ${key}`);
    strings[key] = text;
    return key;
  };
  const opt = (key: string, text: string | undefined) =>
    text === undefined
      ? {}
      : ({ [key.split(".").pop() as string]: put(key, text) } as Record<
          string,
          string
        >);
  const media = (src: string): string => {
    if (src.startsWith("media/")) return src;
    const to = `media/${src.slice("ingest/media/".length).replace(/\//g, "-")}`;
    if (!copies.some((c) => c.to === to)) copies.push({ from: src, to });
    return to;
  };

  const block = (b: DraftBlock): Block => {
    const k = (field: string) => `${b.id}.${field}`;
    const head = opt(k("heading"), b.heading);
    switch (b.type) {
      case "narrative":
        return {
          id: b.id,
          type: "narrative",
          ...head,
          body: put(k("body"), b.body),
          ...(b.image
            ? {
                media: {
                  kind: "image",
                  src: media(b.image.src),
                  alt: put(k("alt"), b.image.alt),
                  decorative: false,
                  zoom: b.image.zoom,
                },
              }
            : {}),
          layout: b.layout ?? (b.image ? "media-end" : "text"),
        };
      case "accordion":
      case "tabs":
        return {
          id: b.id,
          type: b.type,
          ...head,
          ...opt(k("intro"), b.intro),
          items: b.items.map((it) => ({
            id: it.id,
            title: put(k(`i.${it.id}.title`), it.title),
            body: put(k(`i.${it.id}.body`), it.body),
          })),
        };
      case "hotspots":
        return {
          id: b.id,
          type: "hotspots",
          ...head,
          ...opt(k("intro"), b.intro),
          image: { src: media(b.image.src), alt: put(k("alt"), b.image.alt) },
          items: b.items.map((it) => ({
            id: it.id,
            x: it.x,
            y: it.y,
            title: put(k(`i.${it.id}.title`), it.title),
            body: put(k(`i.${it.id}.body`), it.body),
          })),
        };
      case "question":
        return {
          id: b.id,
          type: "question",
          ...head,
          variant: b.variant,
          prompt: put(k("prompt"), b.prompt),
          ...(b.image
            ? {
                image: {
                  src: media(b.image.src),
                  alt: put(k("alt"), b.image.alt),
                },
              }
            : {}),
          choices: b.choices.map((c) => ({
            id: c.id,
            text: put(k(`c.${c.id}`), c.text),
            ...(c.correct === undefined ? {} : { correct: c.correct }),
            feedback: put(k(`c.${c.id}.fb`), c.feedback),
            ...(c.x === undefined ? {} : { x: c.x }),
            ...(c.y === undefined ? {} : { y: c.y }),
          })),
          objectives: b.objectives,
          scored: b.scored,
          attempts: b.attempts,
          shuffle: true,
        };
      case "summary":
        return {
          id: b.id,
          type: "summary",
          ...head,
          points: b.points.map((p, i) => put(k(`p${i + 1}`), p)),
        };
    }
  };

  const module: Module = {
    schemaVersion: "0.1",
    id: frame.id,
    version: frame.version,
    defaultLocale: frame.defaultLocale,
    locales: frame.locales,
    meta: {
      title: put("meta.title", d.title),
      description: put("meta.description", d.description),
      durationMinutes: frame.durationMinutes,
    },
    objectives: d.objectives.map((o) => ({
      id: o.id,
      bloom: frame.bloom[o.id] ?? "understand",
      text: put(`obj.${o.id}`, o.text),
    })),
    assessment: {
      passingScore: frame.passingScore,
      completion: frame.completion,
    },
    sections: d.sections.map((s) => ({
      id: s.id,
      title: put(`${s.id}.title`, s.title),
      screens: s.screens.map((sc) => ({
        id: sc.id,
        title: put(`${sc.id}.title`, sc.title),
        blocks: sc.blocks.map(block),
      })),
    })),
  };
  return { module, strings, copies };
}

/** The draft of an existing module, its texts read from one catalogue (tests, edits, revisions). */
export function moduleToDraft(m: Module, strings: StringCatalog): ModuleDraft {
  const s = (key: string): string => strings[key] ?? "";
  const o = <K extends string>(field: K, key: string | undefined) =>
    key === undefined ? {} : ({ [field]: s(key) } as Record<K, string>);

  const block = (b: Block): DraftBlock => {
    switch (b.type) {
      case "narrative":
        return {
          id: b.id,
          type: "narrative",
          ...o("heading", b.heading),
          body: s(b.body),
          ...(b.media
            ? {
                image: {
                  src: b.media.src,
                  alt: b.media.alt ? s(b.media.alt) : "",
                  zoom: b.media.zoom,
                },
              }
            : {}),
          layout: b.layout,
        };
      case "accordion":
      case "tabs":
        return {
          id: b.id,
          type: b.type,
          ...o("heading", b.heading),
          ...o("intro", b.intro),
          items: b.items.map((it) => ({
            id: it.id,
            title: s(it.title),
            body: s(it.body),
          })),
        };
      case "hotspots":
        return {
          id: b.id,
          type: "hotspots",
          ...o("heading", b.heading),
          ...o("intro", b.intro),
          image: { src: b.image.src, alt: s(b.image.alt) },
          items: b.items.map((it) => ({
            id: it.id,
            x: it.x,
            y: it.y,
            title: s(it.title),
            body: s(it.body),
          })),
        };
      case "question":
        return questionDraft(b, s);
      case "summary":
        return {
          id: b.id,
          type: "summary",
          ...o("heading", b.heading),
          points: b.points.map(s),
        };
    }
  };

  return {
    title: s(m.meta.title),
    description: s(m.meta.description),
    objectives: m.objectives.map((ob) => ({ id: ob.id, text: s(ob.text) })),
    sections: m.sections.map((sec) => ({
      id: sec.id,
      title: s(sec.title),
      screens: sec.screens.map((sc) => ({
        id: sc.id,
        title: s(sc.title),
        blocks: sc.blocks.map(block),
      })),
    })),
    notes: [],
  };
}

function questionDraft(q: Question, s: (key: string) => string): DraftBlock {
  return {
    id: q.id,
    type: "question",
    ...(q.heading ? { heading: s(q.heading) } : {}),
    variant: q.variant,
    prompt: s(q.prompt),
    ...(q.image ? { image: { src: q.image.src, alt: s(q.image.alt) } } : {}),
    choices: q.choices.map((c) => ({
      id: c.id,
      text: s(c.text),
      ...(c.correct === undefined ? {} : { correct: c.correct }),
      feedback: s(c.feedback),
      ...(c.x === undefined ? {} : { x: c.x }),
      ...(c.y === undefined ? {} : { y: c.y }),
    })),
    objectives: q.objectives,
    scored: q.scored,
    attempts: q.attempts,
  };
}
