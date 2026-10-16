// Delivery packages built from the web build: SCORM 1.2 and standalone HTML5, each as a ZIP.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { zipSync } from "fflate";
import { buildWeb, type WebBuild } from "./build-web.ts";

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join("/"))
    .sort();
}

/** Zips a folder; paths use "/" and the folder content sits at the archive root. */
export async function zipDir(dir: string, zipPath: string): Promise<void> {
  const files: Record<string, Uint8Array> = {};
  for (const f of await listFiles(dir))
    files[f] = new Uint8Array(await readFile(join(dir, f)));
  // Already-compressed formats are stored as is (faster, no size gain from deflate).
  const stored = /\.(woff2|png|jpe?g|webp|avif|mp4|webm|mp3|zip)$/i;
  const tree = Object.fromEntries(
    Object.entries(files).map(([name, data]) => [
      name,
      [data, { level: stored.test(name) ? 0 : 9 }] as const,
    ]),
  );
  await writeFile(zipPath, zipSync(tree as Parameters<typeof zipSync>[0]));
}

const escapeXml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c] as string,
  );

const isAssessed = (b: WebBuild) =>
  b.module.sections.some((s) =>
    s.screens.some((sc) =>
      sc.blocks.some((bl) => bl.type === "question" && bl.scored),
    ),
  );
const titleOf = (b: WebBuild) =>
  escapeXml(b.defaultStrings[b.module.meta.title] ?? b.module.id);
const fileList = (files: readonly string[]) =>
  files.map((f) => `      <file href="${escapeXml(f)}"/>`).join("\n");

/** imsmanifest.xml for a single-SCO SCORM 1.2 package (ADL SCORM 1.2 Content Aggregation Model). */
export function scorm12Manifest(
  build: WebBuild,
  files: readonly string[],
): string {
  const { module } = build;
  const title = titleOf(build);
  const mastery = isAssessed(build)
    ? `\n        <adlcp:masteryscore>${module.assessment.passingScore}</adlcp:masteryscore>`
    : "";
  const id = `ldm-${module.id}-${module.version}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="${module.version}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>${title}</title>
      <item identifier="item" identifierref="sco" isvisible="true">
        <title>${title}</title>${mastery}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="sco" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileList(files)}
    </resource>
  </resources>
</manifest>
`;
}

/**
 * imsmanifest.xml for a single-SCO SCORM 2004 4th Edition package (CAM book). The passing threshold
 * is the primary objective's minNormalizedMeasure: the LMS exposes it as cmi.scaled_passing_score.
 */
export function scorm2004Manifest(
  build: WebBuild,
  files: readonly string[],
): string {
  const { module } = build;
  const title = titleOf(build);
  const objectives = isAssessed(build)
    ? `
          <imsss:objectives>
            <imsss:primaryObjective objectiveID="primary" satisfiedByMeasure="true">
              <imsss:minNormalizedMeasure>${(module.assessment.passingScore / 100).toFixed(2)}</imsss:minNormalizedMeasure>
            </imsss:primaryObjective>
          </imsss:objectives>`
    : "";
  const id = `ldm-${module.id}-${module.version}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="${module.version}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>${title}</title>
      <item identifier="item" identifierref="sco" isvisible="true">
        <title>${title}</title>
        <imsss:sequencing>${objectives}
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="sco" type="webcontent" adlcp:scormType="sco" href="index.html">
${fileList(files)}
    </resource>
  </resources>
</manifest>
`;
}

export interface PackageResult {
  dir: string;
  zip: string;
  build: WebBuild;
}

const baseName = (b: WebBuild) => `${b.module.id}-${b.module.version}`;

export async function packageScorm12(
  moduleDir: string,
  outRoot: string,
): Promise<PackageResult> {
  const dir = join(outRoot, "scorm12");
  const build = await buildWeb(moduleDir, dir, { target: "scorm12" });
  await writeFile(
    join(dir, "imsmanifest.xml"),
    scorm12Manifest(build, await listFiles(dir)),
  );
  const zip = join(outRoot, `${baseName(build)}-scorm12.zip`);
  await zipDir(dir, zip);
  return { dir, zip, build };
}

export async function packageScorm2004(
  moduleDir: string,
  outRoot: string,
): Promise<PackageResult> {
  const dir = join(outRoot, "scorm2004");
  const build = await buildWeb(moduleDir, dir, { target: "scorm2004" });
  await writeFile(
    join(dir, "imsmanifest.xml"),
    scorm2004Manifest(build, await listFiles(dir)),
  );
  const zip = join(outRoot, `${baseName(build)}-scorm2004.zip`);
  await zipDir(dir, zip);
  return { dir, zip, build };
}

export async function packageHtml5(
  moduleDir: string,
  outRoot: string,
): Promise<PackageResult> {
  const dir = join(outRoot, "web");
  const build = await buildWeb(moduleDir, dir, { target: "web" });
  const zip = join(outRoot, `${baseName(build)}-html5.zip`);
  await zipDir(dir, zip);
  return { dir, zip, build };
}
