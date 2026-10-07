import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { AstroIntegration } from "astro";
import { parse } from "yaml";
import {
  contentFiles,
  siteConfigSchema,
  validateContent,
  type SiteConfigInput,
  type ValidationIssue,
} from "@agency/site-schema";

export interface AgencyCredit {
  name: string;
  url: string;
}

export interface AgencyOptions {
  /** Shown in every site's footer ("Website by …"). One place to change it for all sites. */
  credit?: AgencyCredit;
}

const DEFAULT_CREDIT: AgencyCredit = {
  name: process.env.AGENCY_NAME ?? "AgencyManager",
  url: process.env.AGENCY_URL ?? "https://github.com/agency-manager",
};

const VIRTUAL_ID = "virtual:agency/site";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

const pkgFile = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

/** Load, parse and validate every content file. Throws a readable error listing all issues. */
async function loadContent(contentDir: string) {
  const data: Record<string, unknown> = {};
  const issues: ValidationIssue[] = [];
  for (const [file, def] of Object.entries(contentFiles)) {
    const key = file.replace(/\.yaml$/, "");
    let raw: unknown;
    try {
      raw = parse(await readFile(join(contentDir, file), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        if (def.kind === "single") issues.push({ file, path: "(file)", message: "required file is missing" });
        data[key] = def.kind === "list" ? [] : null;
        continue;
      }
      issues.push({ file, path: "(file)", message: (e as Error).message });
      continue;
    }
    const fileIssues = validateContent(file as keyof typeof contentFiles, raw);
    issues.push(...fileIssues);
    if (fileIssues.length === 0) {
      const schema = def.kind === "single" ? def.schema : def.schema.array();
      data[key] = schema.parse(raw ?? []);
    }
  }
  if (issues.length) {
    const lines = issues.map((i) => `  ✗ ${i.file} › ${i.path}: ${i.message}`).join("\n");
    throw new Error(`Site content is invalid:\n${lines}`);
  }
  return data;
}

export default function agency(siteConfig: SiteConfigInput, options: AgencyOptions = {}): AstroIntegration {
  const config = siteConfigSchema.parse(siteConfig);
  const credit = options.credit ?? DEFAULT_CREDIT;

  return {
    name: "@agency/astro-core",
    hooks: {
      "astro:config:setup": ({ config: astroConfig, updateConfig, injectRoute, addWatchFile }) => {
        const contentDir = fileURLToPath(new URL("src/content/", astroConfig.root));
        for (const file of Object.keys(contentFiles)) addWatchFile(join(contentDir, file));

        updateConfig({
          site: config.url,
          output: "static",
          vite: {
            plugins: [
              {
                name: "agency-site-data",
                resolveId: (id: string) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
                load: async (id: string) => {
                  if (id !== RESOLVED_ID) return undefined;
                  const content = await loadContent(contentDir);
                  const exports = { config, credit, ...content };
                  return Object.entries(exports)
                    .map(([k, v]) => `export const ${k} = ${JSON.stringify(v)};`)
                    .join("\n");
                },
              },
            ],
          },
        });

        injectRoute({ pattern: "/", entrypoint: pkgFile("pages/index.astro") });
        injectRoute({ pattern: "/services/[id]", entrypoint: pkgFile("pages/services/[id].astro") });
        injectRoute({ pattern: "/contact", entrypoint: pkgFile("pages/contact.astro") });
        injectRoute({ pattern: "/404", entrypoint: pkgFile("pages/404.astro") });
      },
    },
  };
}

export { defineSiteConfig } from "@agency/site-schema";
