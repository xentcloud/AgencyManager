#!/usr/bin/env node
import { resolve } from "node:path";
import { validateContentDir } from "./validate.js";

const dir = resolve(process.argv[2] ?? "src/content");
const issues = await validateContentDir(dir);
if (issues.length === 0) {
  console.log(`✓ content valid (${dir})`);
} else {
  for (const i of issues) console.error(`✗ ${i.file} › ${i.path}: ${i.message}`);
  process.exitCode = 1;
}
