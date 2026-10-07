import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { AstroIntegration } from "astro";
import { parse } from "yaml";
import {
  contentFiles,
  siteConfigSchema,
  validateContentDir,
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
  name: process.env.AGENCY_NAME ?? "Xentryx",
  url: process.env.AGENCY_URL ?? "https://www.xentryx.com",
};

const VIRTUAL_ID = "virtual:agency/site";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

const pkgFile = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

/** `case-studies.yaml` → `caseStudies` */
const exportName = (file: string) => file.replace(/\.yaml$/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Validate every content file (throws a readable list of all issues), then parse with defaults applied. */
async function loadContent(contentDir: string) {
  const issues = await validateContentDir(contentDir);
  if (issues.length) {
    const lines = issues.map((i: ValidationIssue) => `  ✗ ${i.file} › ${i.path}: ${i.message}`).join("\n");
    throw new Error(`Site content is invalid:\n${lines}`);
  }
  const data: Record<string, unknown> = {};
  for (const [file, def] of Object.entries(contentFiles)) {
    let raw: unknown = undefined;
    try {
      raw = parse(await readFile(join(contentDir, file), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    data[exportName(file)] =
      def.kind === "list" ? def.schema.array().parse(raw ?? []) : raw === undefined ? null : def.schema.parse(raw);
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
