# AgencyManager

Open-source platform for running a mostly autonomous small-business website agency:
Astro sites on Cloudflare, AI-agent change requests through GitHub Issues, prospecting, and a portal (self-hosted Convex).

## Layout
| Path | What it is |
|---|---|
| `packages/site-schema` | Zod schemas for `site.config.ts` and `src/content/*.yaml`, plus the `agency-validate` CLI |
| `packages/astro-core` | Astro integration every client site uses: pages, sections, SEO/JSON-LD, analytics, footer credit |
| `templates/site-starter` | Template for new `site-<slug>` customer repos |

## Customer sites are content-as-data
A customer repo contains only `site.config.ts`, `src/content/*.yaml`, images and a one-line `astro.config.mjs`.
Changing hours, services, team or FAQs is a YAML edit that `agency-validate` checks against the schema.
Layout, footer credit and analytics come from `@agency/astro-core`, so a version bump updates every site.

## Develop
```bash
pnpm install
pnpm build
pnpm --filter site-starter dev
```
