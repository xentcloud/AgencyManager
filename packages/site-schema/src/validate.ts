import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import type { z } from "zod";
import { contentFiles, requiredContentFiles } from "./content.js";

export interface ValidationIssue {
  file: string;
  path: string;
  message: string;
}

type ContentFileName = keyof typeof contentFiles;

/** Validate one parsed content file. Lists must have unique ids. */
export function validateContent(file: ContentFileName, data: unknown): ValidationIssue[] {
  const def = contentFiles[file];
  const issues: ValidationIssue[] = [];
  const schema: z.ZodType = def.kind === "single" ? def.schema : (def.schema.array() as z.ZodType);
  const result = schema.safeParse(data ?? (def.kind === "list" ? [] : undefined));
  if (!result.success) {
    for (const i of result.error.issues) {
      issues.push({ file, path: i.path.join(".") || "(root)", message: i.message });
    }
    return issues;
  }
  if (def.kind === "list") {
    const seen = new Set<string>();
    for (const item of result.data as Array<{ id: string }>) {
      if (seen.has(item.id)) issues.push({ file, path: item.id, message: `duplicate id "${item.id}"` });
      seen.add(item.id);
    }
  }
  return issues;
}

/** Validate every known content file in a site's `src/content` directory. */
export async function validateContentDir(dir: string): Promise<ValidationIssue[]> {
  const present = new Set(await readdir(dir).catch(() => [] as string[]));
  const issues: ValidationIssue[] = [];
  for (const required of requiredContentFiles) {
    if (!present.has(required)) issues.push({ file: required, path: "(file)", message: "required file is missing" });
  }
  for (const name of Object.keys(contentFiles) as ContentFileName[]) {
    if (!present.has(name)) continue;
    let data: unknown;
    try {
      data = parse(await readFile(join(dir, name), "utf8"));
    } catch (e) {
      issues.push({ file: name, path: "(file)", message: `invalid YAML: ${(e as Error).message}` });
      continue;
    }
    issues.push(...validateContent(name, data));
  }
  return issues;
}
