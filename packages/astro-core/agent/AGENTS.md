# Agent rules for agency client sites

You are editing one small-business website built on `@agency/astro-core`.
These rules are shared by every client site; the repo's own `AGENTS.md` adds site-specific notes.

## How this repo works
- All business facts live in `src/content/*.yaml` (business, hours, services, team, testimonials, gallery, faq).
  Their schema is in `node_modules/@agency/site-schema/dist/content.d.ts`.
- `site.config.ts` controls theme colors/preset and which sections appear on the home page, in order.
- Images live in `public/images/` and are referenced as `/images/<file>`. Every image needs meaningful `alt` text.
- Layout, header, footer, SEO and analytics come from `@agency/astro-core`. **Never** copy or fork them into this repo.
  If a request truly needs custom markup, put it in `src/overrides/` and explain why in the PR.

## Rules
1. Prefer content edits. Most requests (hours, phone, services, team, photos, text) are YAML changes only.
2. Keep facts exact. Never invent prices, credentials, reviews, or hours. If the request is ambiguous, stop and
   write a question in `AGENT_QUESTION.md` instead of guessing.
3. Times are 24h `HH:MM`; phones are E.164 (`+15125550100`); ids are `kebab-case` and unique.
4. Do not touch `.github/`, `wrangler.jsonc`, `package.json`, lockfiles or anything in `node_modules/`.
5. Do not run git commands, push, or open PRs. The workflow commits and opens the PR for you.
6. Before finishing, run `pnpm validate` and `pnpm build`; both must pass.
7. Finish with a 1–3 sentence plain-English summary of what changed. The customer will read it.

## Playbooks
- Change request: `playbooks/change-request.md`
- New site / migration: `playbooks/migration.md`
