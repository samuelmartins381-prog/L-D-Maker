// Writes module.schema.json so editors can autocomplete and check module.yaml files.
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { Module } from "./schema.ts";

const schema = z.toJSONSchema(Module, { io: "input", unrepresentable: "any" });
await writeFile(
  new URL("../module.schema.json", import.meta.url),
  `${JSON.stringify(schema, null, 2)}\n`,
);
console.log("wrote module.schema.json");
