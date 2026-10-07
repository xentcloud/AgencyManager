import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const REPO = "xentcloud/site-demo";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert("organizations", { name: "Demo", slug: "demo", kind: "customer", status: "active" });
    const siteId = await ctx.db.insert("sites", {
      orgId, slug: "demo", name: "Demo", productKind: "astro-static", repo: REPO, status: "live",
    });
    const crId = await ctx.db.insert("changeRequests", {
      orgId, siteId, source: "portal", summary: "Change hours", body: "Sat 9-1", state: "queued",
      tier: "content", agent: "claude", replyToken: "abc", iterations: 0, issueNumber: 7,
    });
    return { orgId, siteId, crId };
  });
  const cr = () => t.run((ctx) => ctx.db.get(ids.crId));
  return { t, ids, cr };
}

describe("GitHub webhook state machine", () => {
  it("walks a request from PR to preview to deployed", async () => {
    const { t, ids, cr } = await setup();

    await t.mutation(internal.githubEvents.handle, {
      event: "pull_request", action: "opened", repo: REPO, prNumber: 8, branch: "agent/issue-7", labels: ["tier:content"],
    });
    expect(await cr()).toMatchObject({ state: "in_progress", prNumber: 8, tier: "content" });

    await t.mutation(internal.githubEvents.handle, {
      event: "deployment_status", repo: REPO, branch: "agent/issue-7", environment: "preview",
      deployState: "success", url: "https://pr-8-site-demo.example.workers.dev",
    });
    expect(await cr()).toMatchObject({ state: "preview_ready", previewUrl: "https://pr-8-site-demo.example.workers.dev" });

    await t.run((ctx) => ctx.db.patch(ids.crId, { state: "approved" }));
    await t.mutation(internal.githubEvents.handle, {
      event: "deployment_status", repo: REPO, branch: "main", environment: "production",
      deployState: "success", url: "https://site-demo.example.workers.dev", sha: "abc123",
    });
    expect((await cr())!.state).toBe("deployed");
    const deployments = await t.run((ctx) => ctx.db.query("deployments").collect());
    expect(deployments).toHaveLength(1);
  });

  it("marks code-tier PRs and agent failures", async () => {
    const { t, cr } = await setup();
    await t.mutation(internal.githubEvents.handle, {
      event: "pull_request", action: "opened", repo: REPO, prNumber: 9, branch: "agent/issue-7", labels: ["tier:code"],
    });
    expect((await cr())!.tier).toBe("code");
    await t.mutation(internal.githubEvents.handle, { event: "issues", action: "labeled", repo: REPO, issueNumber: 7, label: "needs-human" });
    expect((await cr())!.state).toBe("needs_human");
  });

  it("ignores events for unknown repos and unrelated branches", async () => {
    const { t, cr } = await setup();
    await t.mutation(internal.githubEvents.handle, { event: "pull_request", action: "opened", repo: "other/repo", prNumber: 1, branch: "agent/issue-7" });
    await t.mutation(internal.githubEvents.handle, { event: "pull_request", action: "opened", repo: REPO, prNumber: 2, branch: "feature/x" });
    expect((await cr())!.state).toBe("queued");
  });
});
