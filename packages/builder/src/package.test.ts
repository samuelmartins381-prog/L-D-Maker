import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Module } from "@ldm/schema";
import { describe, expect, it } from "vitest";
import type { WebBuild } from "./build-web.ts";
import { scorm12Manifest } from "./package.ts";

const build = (scored: boolean): WebBuild => ({
  outDir: "",
  warnings: [],
  defaultStrings: { "m.title": "Sécurité & « e-mails »" },
  module: {
    id: "demo",
    version: "1.2.0",
    meta: { title: "m.title" },
    assessment: { passingScore: 75 },
    sections: [{ screens: [{ blocks: [{ type: "question", scored }] }] }],
  } as unknown as Module,
});

describe("scorm12Manifest", () => {
  const xml = scorm12Manifest(build(true), ["index.html", "assets/a&b.css"]);

  it("is well-formed XML with escaped titles and file names", () => {
    const file = join(mkdtempSync(join(tmpdir(), "ldm-")), "imsmanifest.xml");
    writeFileSync(file, xml);
    expect(() => execFileSync("xmllint", ["--noout", file])).not.toThrow();
    expect(xml).toContain("<title>Sécurité &amp; « e-mails »</title>");
    expect(xml).toContain('<file href="assets/a&amp;b.css"/>');
  });

  it("declares one SCO launching index.html, with a valid identifier", () => {
    expect(xml).toContain('adlcp:scormtype="sco" href="index.html"');
    expect(xml).toContain('identifier="ldm-demo-1.2.0"');
    expect(xml).toContain("<schemaversion>1.2</schemaversion>");
  });

  it("sets the mastery score only when the module is assessed", () => {
    expect(xml).toContain("<adlcp:masteryscore>75</adlcp:masteryscore>");
    expect(scorm12Manifest(build(false), ["index.html"])).not.toContain(
      "masteryscore",
    );
  });
});
