import { z } from "zod";
import { hexColor, slug } from "./primitives.js";

export const productKinds = ["astro-static", "astro-emdash"] as const;

export const themePresets = ["classic", "modern", "bold", "warm"] as const;

export const siteConfigSchema = z.object({
  /** Stable site id; matches the repo name `site-<id>` and the Worker name. */
  id: slug,
  productKind: z.enum(productKinds).default("astro-static"),
  /** Canonical production URL, e.g. https://smiledental.com */
  url: z.url(),
  locale: z.string().default("en-US"),
  /** Path under /public, e.g. "/favicon.svg". Falls back to the business logo. */
  favicon: z.string().startsWith("/").optional(),
  theme: z
    .object({
      preset: z.enum(themePresets).default("modern"),
      primary: hexColor.default("#1d4ed8"),
      accent: hexColor.default("#f59e0b"),
    })
    .prefault({}),
  /** Sections rendered on the home page, in order. */
  home: z
    .array(z.enum(["hero", "services", "about", "stack", "work", "team", "gallery", "testimonials", "hours", "faq", "contact"]))
    .default(["hero", "services", "about", "testimonials", "hours", "contact"]),
  analytics: z
    .object({
      cloudflareToken: z.string().optional(),
      umami: z.object({ src: z.url(), websiteId: z.string() }).optional(),
    })
    .prefault({}),
  forms: z
    .object({
      /** Agency edge endpoint that receives contact form submissions. */
      endpoint: z.url().optional(),
      turnstileSiteKey: z.string().optional(),
    })
    .prefault({}),
});

export type SiteConfigInput = z.input<typeof siteConfigSchema>;
export type SiteConfig = z.output<typeof siteConfigSchema>;

/** Identity helper with type checking for `site.config.ts`. */
export function defineSiteConfig(config: SiteConfigInput): SiteConfigInput {
  return config;
}
