// Fails the build when a dependency's license is not allowed (see ADR 0001).
// Production dependencies may end up inside delivered modules, so they get the strict list.
import { execFileSync } from "node:child_process";

const PROD_ALLOWED = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "OFL-1.1",
  "MIT OR Apache-2.0",
]);
// Dev tooling is never shipped, so weak copyleft (e.g. axe-core, MPL-2.0) is acceptable.
const DEV_ALLOWED = new Set([
  ...PROD_ALLOWED,
  "MPL-2.0",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "Python-2.0",
  "Unlicense",
  "(MIT OR CC0-1.0)",
]);

function listLicenses(prodOnly) {
  const args = ["-r", "licenses", "list", "--json"];
  if (prodOnly) args.push("--prod");
  const out = execFileSync("pnpm", args, { encoding: "utf8" }).trim();
  return out.startsWith("{") ? JSON.parse(out) : {};
}

function check(prodOnly, allowed) {
  const violations = [];
  for (const [license, pkgs] of Object.entries(listLicenses(prodOnly))) {
    if (allowed.has(license)) continue;
    for (const pkg of pkgs)
      violations.push(`${pkg.name}@${pkg.versions.join(",")}: ${license}`);
  }
  return violations;
}

const prod = check(true, PROD_ALLOWED);
const dev = check(false, DEV_ALLOWED);
for (const v of prod) console.error(`[prod] license not allowed: ${v}`);
for (const v of dev) console.error(`[dev] license not allowed: ${v}`);
if (prod.length || dev.length) process.exit(1);
console.log("licenses: OK");
