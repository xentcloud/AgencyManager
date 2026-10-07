# Playbook: new site / migration

Input: an issue with the source URL (customer's current site or a reference site) and notes.

1. Read the source pages (home, services, about, team, contact). Extract facts only.
2. Fill `src/content/*.yaml`. Required: `business.yaml`, `hours.yaml`, `services.yaml`.
   - Rewrite copy lightly for clarity and fix typos; never change facts.
   - If sources conflict (e.g. two different phone numbers or ratings), leave it out and list it in the PR description.
3. Images: only use the customer's own images (logo, team, office). Never copy a competitor's text or photos.
   When building "based on a competitor", use the competitor only for structure and ideas.
4. Pick a theme preset and colors matching the brand (logo colors) in `site.config.ts`.
5. List in the PR: missing facts, conflicts, and features the old site had that the template lacks.
6. Run `pnpm validate && pnpm build`.
