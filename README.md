# AgencyManager

Open-source platform for running a mostly autonomous small-business website agency:
Astro sites on Cloudflare, AI-agent change requests through GitHub Issues, prospecting, and a portal (self-hosted Convex).

## Layout
| Path | What it is |
|---|---|
| `packages/site-schema` | Zod schemas for `site.config.ts` and `src/content/*.yaml`, plus the `agency-validate` CLI |
| `packages/astro-core` | Astro integration every client site uses: pages, sections, SEO/JSON-LD, analytics, footer credit |
| `packages/backend` | Convex backend (self-hosted): schema, Better Auth, portal API, edge endpoints, SMTP email |
| `apps/portal` | Agency + customer portal (Vite, React, TanStack Router, shadcn/ui) |
| `apps/edge` | Shared Cloudflare Worker: multi-tenant contact forms (`POST /f/<siteId>`) and inbound email |
| `templates/site-starter` | Template for new `site-<slug>` customer repos, with a thin workflow calling ours |
| `examples/lemus-dental` | First migration (from a Wix site), built purely from YAML |
| `.github/workflows/site-*.yml` | Reusable workflows every client repo calls: agent, CI, preview, deploy |
| `infra/convex` | Docker Compose for self-hosted Convex + Postgres |

## Customer sites are content-as-data
A customer repo contains only `site.config.ts`, `src/content/*.yaml`, images and a one-line `astro.config.mjs`.
Changing hours, services, team or FAQs is a YAML edit that `agency-validate` checks against the schema.
Layout, footer credit and analytics come from `@agency/astro-core`, so a version bump updates every site.

## Develop
```bash
pnpm install && pnpm build
cp infra/convex/.env.example infra/convex/.env   # set POSTGRES_PASSWORD
docker compose -f infra/convex/docker-compose.yml --env-file infra/convex/.env up -d
docker compose -f infra/convex/docker-compose.yml exec backend ./generate_admin_key.sh
# packages/backend/.env.local: CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210, CONVEX_SELF_HOSTED_ADMIN_KEY=<key>
cd packages/backend && npx convex env set SITE_URL http://localhost:5173 \
  && npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)" && npx convex dev
pnpm --filter portal dev        # http://localhost:5173 — first sign-up becomes agency admin
```

## How agents work
The portal turns a customer request into a GitHub issue labeled `type:change` (+ `agent:claude` or `agent:codex`).
The site repo's `agency.yml` calls `site-agent.yml`, which runs the agent as a file editor only, then validates,
builds, commits and opens the PR with the agency GitHub App token. PRs get a Cloudflare preview; merge deploys.
Agents never receive Cloudflare credentials, and the App lacks `workflows: write` so agents can't edit CI.
