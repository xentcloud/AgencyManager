import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { findByIssue } from "./changeRequests";

const AGENT_BRANCH = /^agent\/issue-(\d+)$/;

async function log(ctx: MutationCtx, cr: Doc<"changeRequests">, action: string, data?: unknown) {
  await ctx.db.insert("auditLog", { actor: "github", action, target: cr._id, data });
}

/**
 * Advance change requests from GitHub App webhooks. Payload fields are pre-extracted by the
 * HTTP action so this mutation stays small and validated.
 */
export const handle = internalMutation({
  args: {
    event: v.string(),
    action: v.optional(v.string()),
    repo: v.string(),
    issueNumber: v.optional(v.number()),
    prNumber: v.optional(v.number()),
    branch: v.optional(v.string()),
    merged: v.optional(v.boolean()),
    label: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    environment: v.optional(v.string()),
    deployState: v.optional(v.string()),
    url: v.optional(v.string()),
    sha: v.optional(v.string()),
    prBody: v.optional(v.string()),
  },
  handler: async (ctx, e) => {
    // Agent PRs come from `agent/issue-<n>`; preview/production deployments carry the head branch or main.
    const fromBranch = e.branch?.match(AGENT_BRANCH)?.[1];
    const issueNumber = e.issueNumber ?? (fromBranch ? Number(fromBranch) : undefined);

    if (e.event === "deployment_status" && e.environment === "production" && e.deployState === "success") {
      const site = await ctx.db.query("sites").withIndex("by_repo", (q) => q.eq("repo", e.repo)).first();
      if (!site) return;
      await ctx.db.insert("deployments", {
        siteId: site._id, environment: "production", url: e.url ?? "", commitSha: e.sha ?? "", status: "success",
      });
      await ctx.db.patch(site._id, { status: "live", productionUrl: site.productionUrl ?? e.url });
      // Every approved request on this site is now live.
      const approved = await ctx.db.query("changeRequests").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
      for (const cr of approved.filter((c) => c.state === "approved")) {
        await ctx.db.patch(cr._id, { state: "deployed" });
        await log(ctx, cr, "request.deployed", { url: e.url, sha: e.sha });
      }
      return;
    }

    if (issueNumber === undefined) return;
    const cr = await findByIssue(ctx, e.repo, issueNumber);
    if (!cr) return;

    switch (e.event) {
      case "pull_request":
        if (e.action === "opened" || e.action === "synchronize" || e.action === "reopened") {
          const tier = e.labels?.includes("tier:code") ? "code" : "content";
          await ctx.db.patch(cr._id, { prNumber: e.prNumber, tier, state: "in_progress" });
          await log(ctx, cr, e.action === "opened" ? "pr.opened" : "pr.updated", { prNumber: e.prNumber, tier, summary: e.prBody?.split("\n\nCloses")[0] });
        } else if (e.action === "closed" && !e.merged && cr.state !== "approved") {
          await ctx.db.patch(cr._id, { state: "cancelled" });
          await log(ctx, cr, "pr.closed_unmerged");
        }
        break;
      case "deployment_status":
        if (e.environment === "preview" && e.deployState === "success" && e.url) {
          await ctx.db.patch(cr._id, { state: "preview_ready", previewUrl: e.url, lastError: undefined });
          await log(ctx, cr, "preview.ready", { url: e.url });
          // TODO(phase 3): notify the requester (email/SMS) with the preview link and reply token.
        }
        break;
      case "issues":
        if (e.action === "labeled" && (e.label === "needs-human" || e.label === "needs-info")) {
          await ctx.db.patch(cr._id, { state: "needs_human" });
          await log(ctx, cr, e.label === "needs-info" ? "agent.question" : "agent.failed");
        }
        break;
    }
  },
});
