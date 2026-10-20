import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadModuleSource, Module, validateModule } from "@ldm/schema";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { approveStoryboard } from "../approval.ts";
import { moduleToDraft } from "../draft.ts";
import { assertApproved } from "../storyboard.ts";
import type { LlmAnswer, LlmCall, LlmClient } from "./llm.ts";
import { estimateModule, writeModule } from "./module.ts";
import { translateModule, translationStatus } from "./translate.ts";

const DEMO = new URL(
  "../../../../projects/mouvement-mecanique",
  import.meta.url,
).pathname;
const IMAGE = "ingest/media/guide-mouvement/img-000.png";

/** The demo project, sources read and storyboard approved, without its module. */
async function approvedDemo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "ldm-module-"));
  for (const f of ["project.yaml", "sources", "ingest", "storyboard.yaml"])
    cpSync(join(DEMO, f), join(dir, f), { recursive: true });
  await approveStoryboard(dir, "Sam");
  return dir;
}

/** The hand-written demo module, as Claude would answer it, its pictures taken from the sources. */
function demoDraft(): string {
  const m = Module.parse(
    parse(readFileSync(join(DEMO, "module/module.yaml"), "utf8")),
  );
  const fr = JSON.parse(
    readFileSync(join(DEMO, "module/strings/fr.json"), "utf8"),
  );
  const text = JSON.stringify({
    ...moduleToDraft(m, fr),
    notes: [
      "Le schéma du mouvement vient du guide ; un visuel de la marque serait préférable.",
    ],
  });
  return text.replaceAll("media/movement.svg", IMAGE);
}

const answer = (text: string): LlmAnswer => ({
  text,
  content: [{ type: "text", text }],
  stopReason: "end_turn",
  usage: { input_tokens: 30_000, output_tokens: 20_000 },
});

function replay(answers: string[]): LlmClient & { calls: LlmCall[] } {
  const calls: LlmCall[] = [];
  return {
    calls,
    async countTokens() {
      return 30_000;
    },
    async complete(call) {
      calls.push(structuredClone(call));
      return answer(answers.shift() ?? "{}");
    },
  };
}

/** A translator that answers "[en] <text>" for every item it is sent, or breaks the markup on demand. */
function translator(breakMarkup = false): LlmClient & { sent: number[] } {
  const sent: number[] = [];
  return {
    sent,
    async countTokens() {
      return 1_000;
    },
    async complete(call) {
      const last = call.messages[0]?.content;
      const block = Array.isArray(last) ? last[last.length - 1] : undefined;
      const json = (block && "text" in block ? block.text : "").replace(
        /^[^{]*/s,
        "",
      );
      const { items } = JSON.parse(json) as {
        items: { key: string; text: string }[];
      };
      sent.push(items.length);
      return answer(
        JSON.stringify({
          items: items.map((i) => ({
            key: i.key,
            text: `[en] ${breakMarkup ? i.text.replaceAll("**", "") : i.text}`,
          })),
        }),
      );
    },
  };
}

describe("writeModule", () => {
  it("refuses to write before Sam approves the storyboard", async () => {
    const dir = await approvedDemo();
    writeFileSync(
      join(dir, "storyboard.yaml"),
      `${readFileSync(join(dir, "storyboard.yaml"), "utf8")}\n# edited\n`,
    );
    await expect(writeModule(dir, { client: replay([]) })).rejects.toThrow(
      /approved/,
    );
  });

  it("writes a valid module from the approved storyboard, after a correction round", async () => {
    const dir = await approvedDemo();
    const client = replay(["{}", demoDraft()]);
    const e = await estimateModule(dir, { client, knowledge: "Le spiral…" });
    expect(e.inputTokens).toBe(30_000);
    const r = await writeModule(dir, { client, knowledge: "Le spiral…" });
    expect(r.rounds).toBe(2);
    expect(r.issues.filter((i) => i.severity === "error")).toEqual([]);
    // The storyboard and the knowledge went out; the correction named the problems.
    const sent = JSON.stringify(client.calls[0]?.messages);
    expect(sent).toContain("<domain-knowledge>");
    expect(sent).toContain("# Approved storyboard");
    expect(JSON.stringify(client.calls[1]?.messages.at(-1))).toContain(
      "automatic checks",
    );

    const source = await loadModuleSource(join(dir, "module"));
    expect(validateModule(source).ok).toBe(true);
    expect(source.mediaFiles).toEqual(["media/guide-mouvement-img-000.png"]);
    const fr = source.strings.fr as Record<string, string>;
    expect(Object.values(fr).join(" ")).toContain(" 800"); // French typography applied
    expect(readFileSync(join(dir, "module-notes.md"), "utf8")).toContain(
      "visuel",
    );
    expect(readFileSync(join(dir, "generation-log.jsonl"), "utf8")).toContain(
      '"step":"module"',
    );
    await expect(assertApproved(dir)).resolves.toBeDefined();
  });

  it("keeps the previous module when writing again", async () => {
    const dir = await approvedDemo();
    await writeModule(dir, { client: replay([demoDraft()]) });
    await writeModule(dir, { client: replay([demoDraft()]) });
    expect(existsSync(join(dir, "module.previous", "module.yaml"))).toBe(true);
    const m = parse(readFileSync(join(dir, "module", "module.yaml"), "utf8"));
    expect(m.version).toBe("1.1.0");
  });
});

describe("translateModule", () => {
  it("translates, then sends again only the texts that changed", async () => {
    const dir = await approvedDemo();
    await writeModule(dir, { client: replay([demoDraft()]) });
    const before = await translationStatus(dir);
    expect(before.find((s) => s.locale === "en")?.pending).toBeGreaterThan(100);

    const t = translator();
    await translateModule(dir, "en", { client: t });
    const source = await loadModuleSource(join(dir, "module"));
    expect((source.module as { locales: string[] }).locales).toEqual([
      "fr",
      "en",
    ]);
    expect(validateModule(source).ok).toBe(true);
    expect(
      (await translationStatus(dir)).find((s) => s.locale === "en")?.pending,
    ).toBe(0);

    // Sam retouches one sentence: one text to translate again, the rest is kept.
    const file = join(dir, "module", "strings", "fr.json");
    const fr = JSON.parse(readFileSync(file, "utf8"));
    fr["meta.title"] = "Le mouvement mécanique, expliqué";
    writeFileSync(file, JSON.stringify(fr));
    expect(
      (await translationStatus(dir)).find((s) => s.locale === "en")?.pending,
    ).toBe(1);
    await translateModule(dir, "en", { client: t });
    expect(t.sent).toEqual([t.sent[0], 1]);
    const en = JSON.parse(
      readFileSync(join(dir, "module", "strings", "en.json"), "utf8"),
    );
    expect(en["meta.title"]).toBe("[en] Le mouvement mécanique, expliqué");
  });

  it("refuses a translation that loses the markup, and writes nothing", async () => {
    const dir = await approvedDemo();
    await writeModule(dir, { client: replay([demoDraft()]) });
    await expect(
      translateModule(dir, "en", { client: translator(true) }),
    ).rejects.toThrow(/bold differ/);
    expect(existsSync(join(dir, "module", "strings", "en.json"))).toBe(false);
  });
});
