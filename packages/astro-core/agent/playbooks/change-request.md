# Playbook: change request

Input: a GitHub issue written from a customer's SMS/WhatsApp/email, plus any `/revise` feedback comments.

1. Read the issue and every feedback comment. Later feedback overrides earlier requests.
2. Decide the smallest edit. Map common requests:
   - hours, holiday closures → `src/content/hours.yaml` (`weekly` or `exceptions`)
   - phone, email, address, about text, hero text → `src/content/business.yaml`
   - add/remove/edit a service → `src/content/services.yaml`
   - staff changes → `src/content/team.yaml`
   - section order / colors → `site.config.ts`
3. If the request needs an image that wasn't attached, or facts you don't have, write `AGENT_QUESTION.md` and stop.
4. Run `pnpm validate && pnpm build`.
5. Summarize the change in plain English for the customer.
