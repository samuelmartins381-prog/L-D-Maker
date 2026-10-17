import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readDocx } from "./docx.ts";
import { readPptx } from "./pptx.ts";

const W = 'xmlns:w="w" xmlns:r="r" xmlns:a="a" xmlns:wp="wp"';
const para = (inner: string, props = "") =>
  `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${inner}</w:p>`;
const run = (t: string, rPr = "") =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;

describe("readDocx", () => {
  it("finds headings by style name whatever the style id, and keeps lists, emphasis and tables", async () => {
    const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/></w:style></w:styles>`;
    const body = [
      para(run("L&apos;échappement"), '<w:pStyle w:val="Titre1"/>'),
      para(run("Le ") + run("spiral", "<w:b/>") + run(" règle la marche.")),
      para(run("Remonter"), '<w:numPr><w:ilvl w:val="0"/></w:numPr>'),
      para(run("Régler"), '<w:numPr><w:ilvl w:val="0"/></w:numPr>'),
      `<w:tbl><w:tr><w:tc>${para(run("Fréquence"))}</w:tc><w:tc>${para(run("Hz"))}</w:tc></w:tr><w:tr><w:tc>${para(run("28 800 A/h"))}</w:tc><w:tc>${para(run("4"))}</w:tc></w:tr></w:tbl>`,
    ].join("");
    const docx = zipSync({
      "word/document.xml": strToU8(
        `<w:document ${W}><w:body>${body}</w:body></w:document>`,
      ),
      "word/styles.xml": strToU8(styles),
    });
    const { markdown } = await readDocx(docx);
    expect(markdown).toBe(
      [
        "# L'échappement",
        "Le **spiral** règle la marche.",
        "- Remonter\n- Régler",
        "| Fréquence | Hz |\n| --- | --- |\n| 28 800 A/h | 4 |",
      ].join("\n\n"),
    );
  });
});

describe("readPptx", () => {
  it("follows the presentation order, not the file names, and keeps the notes", async () => {
    const sp = (ph: string, t: string) =>
      `<p:sp><p:nvSpPr><p:nvPr>${ph ? `<p:ph type="${ph}"/>` : ""}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
    const slide = (inner: string) =>
      strToU8(
        `<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`,
      );
    const rels = (items: [string, string, string][]) =>
      strToU8(
        `<Relationships>${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://x/${type}" Target="${target}"/>`).join("")}</Relationships>`,
      );
    const pptx = zipSync({
      "ppt/presentation.xml": strToU8(
        '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="1" r:id="rId2"/><p:sldId id="2" r:id="rId1"/></p:sldIdLst></p:presentation>',
      ),
      "ppt/_rels/presentation.xml.rels": rels([
        ["rId1", "slide", "slides/slide1.xml"],
        ["rId2", "slide", "slides/slide2.xml"],
      ]),
      "ppt/slides/slide1.xml": slide(
        sp("title", "Deuxième") + sp("sldNum", "2"),
      ),
      "ppt/slides/slide2.xml": slide(
        sp("ctrTitle", "Première") + sp("", "Texte"),
      ),
      "ppt/slides/_rels/slide2.xml.rels": rels([
        ["rId9", "notesSlide", "../notesSlides/notesSlide1.xml"],
      ]),
      "ppt/notesSlides/notesSlide1.xml": strToU8(
        `<p:notes xmlns:p="p" xmlns:a="a">${sp("sldImg", "")}${sp("body", "Dire bonjour")}</p:notes>`,
      ),
    });
    const { markdown } = await readPptx(pptx);
    expect(markdown).toBe(
      "<!-- slide 1 -->\n# Première\nTexte\n### Notes:\nDire bonjour\n\n<!-- slide 2 -->\n# Deuxième",
    );
  });
});
