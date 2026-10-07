import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { changeRequestState } from "./schema";
import { requireOrgAccess, requireViewer } from "./lib/access";

const OPEN_STATES = ["received", "queued", "in_progress", "preview_ready", "revising", "approved", "needs_human"] as const;

async function log(ctx: MutationCtx, actor: string, action: string, crId: Id<"changeRequests">, data?: unknown) {
  await ctx.db.insert("auditLog", { actor, action, target: crId, data });
}

function newReplyToken() {
  // Routing token for email/SMS replies (not an auth capability: approvals require a signed-in user).
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

// ── Portal API ───────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    siteId: v.id("sites"),
    summary: v.string(),
    body: v.string(),
    agent: v.optional(v.union(v.literal("claude"), v.literal("codex"))),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError("Site not found");
    const viewer = await requireOrgAccess(ctx, site.orgId);
    if (!site.repo) throw new ConvexError("This site isn't connected to a repository yet");
    const summary = args.summary.trim().slice(0, 120);
    if (!summary) throw new ConvexError("Summary is required");
    // TODO(phase 6): enforce the plan's monthly request quota here, before any agent runs.
    const id = await ctx.db.insert("changeRequests", {
      orgId: site.orgId,
      siteId: site._id,
      source: "portal",
      summary,
      body: args.body.trim(),
      state: "received",
      tier: "content",
      agent: args.agent ?? "claude",
      replyToken: newReplyToken(),
      iterations: 0,
      requestedBy: viewer.userId,
    });
    await log(ctx, viewer.userId, "request.created", id);
    await ctx.scheduler.runAfter(0, internal.github.app.createIssue, { changeRequestId: id });
    return id;
  },
});

export const list = query({
  args: { open: v.optional(v.boolean()) },
  handler: async (ctx, { open }) => {
    const viewer = await requireViewer(ctx);
    const orgIds = new Set(viewer.memberships.map((m) => m.orgId));
    const all = await ctx.db.query("changeRequests").order("desc").take(200);
    const visible = all.filter(
      (cr) => (viewer.isAgency || orgIds.has(cr.orgId)) && (!open || (OPEN_STATES as readonly string[]).includes(cr.state)),
    );
    return Promise.all(visible.map(async (cr) => ({ ...cr, siteName: (await ctx.db.get(cr.siteId))?.name ?? "?" })));
  },
});

export const get = query({
  args: { id: v.id("changeRequests") },
  handler: async (ctx, { id }) => {
    const cr = await ctx.db.get(id);
    if (!cr) return null;
    const viewer = await requireOrgAccess(ctx, cr.orgId);
    const site = await ctx.db.get(cr.siteId);
    const timeline = await ctx.db.query("auditLog").withIndex("by_target", (q) => q.eq("target", id)).collect();
    return { ...cr, site, timeline, canApprove: cr.state === "preview_ready" && (cr.tier === "content" || viewer.isAgency) };
  },
});

export const approve = mutation({
  args: { id: v.id("changeRequests") },
  handler: async (ctx, { id }) => {
    const cr = await ctx.db.get(id);
    if (!cr) throw new ConvexError("Request not found");
    const viewer = await requireOrgAccess(ctx, cr.orgId);
    if (cr.state !== "preview_ready") throw new ConvexError("There's no preview waiting for approval");
    if (cr.tier === "code" && !viewer.isAgency) throw new ConvexError("Code changes need agency review before going live");
    await ctx.db.patch(id, { state: "approved" });
    await log(ctx, viewer.userId, "request.approved", id);
    await ctx.scheduler.runAfter(0, internal.github.app.mergePullRequest, { changeRequestId: id });
  },
});

export const requestChanges = mutation({
  args: { id: v.id("changeRequests"), feedback: v.string() },
  handler: async (ctx, { id, feedback }) => {
    const cr = await ctx.db.get(id);
    if (!cr) throw new ConvexError("Request not found");
    const viewer = await requireOrgAccess(ctx, cr.orgId);
    if (!["preview_ready", "needs_human"].includes(cr.state) || !cr.issueNumber) {
      throw new ConvexError("Feedback can be sent once a preview is ready");
    }
    const text = feedback.trim();
    if (!text) throw new ConvexError("Describe what to change");
    await ctx.db.patch(id, { state: "revising", iterations: cr.iterations + 1, lastError: undefined });
    await log(ctx, viewer.userId, "request.feedback", id, { feedback: text });
    await ctx.scheduler.runAfter(0, internal.github.app.postRevision, { changeRequestId: id, feedback: text });
  },
});

// ── Internal (GitHub actions & webhooks) ────────────────────────────────

export const forGitHub = internalQuery({
  args: { changeRequestId: v.id("changeRequests") },
  handler: async (ctx, { changeRequestId }) => {
    const cr = await ctx.db.get(changeRequestId);
    if (!cr) throw new Error("Change request not found");
    const site = await ctx.db.get(cr.siteId);
    return { ...cr, repo: site?.repo, siteSlug: site?.slug };
  },
});

export const markQueued = internalMutation({
  args: { changeRequestId: v.id("changeRequests"), issueNumber: v.number() },
  handler: async (ctx, { changeRequestId, issueNumber }) => {
    await ctx.db.patch(changeRequestId, { state: "queued", issueNumber });
    await log(ctx, "github", "issue.opened", changeRequestId, { issueNumber });
  },
});

export const markNeedsHuman = internalMutation({
  args: { changeRequestId: v.id("changeRequests"), reason: v.string() },
  handler: async (ctx, { changeRequestId, reason }) => {
    await ctx.db.patch(changeRequestId, { state: "needs_human", lastError: reason.slice(0, 500) });
    await log(ctx, "system", "request.needs_human", changeRequestId, { reason: reason.slice(0, 500) });
  },
});

/** Find the request behind a GitHub issue/PR in a site repo. */
export async function findByIssue(ctx: MutationCtx, repo: string, issueNumber: number) {
  const site = await ctx.db.query("sites").withIndex("by_repo", (q) => q.eq("repo", repo)).first();
  if (!site) return null;
  return ctx.db
    .query("changeRequests")
    .withIndex("by_site_issue", (q) => q.eq("siteId", site._id).eq("issueNumber", issueNumber))
    .first();
}

export const setState = internalMutation({
  args: { changeRequestId: v.id("changeRequests"), state: changeRequestState },
  handler: async (ctx, { changeRequestId, state }) => {
    await ctx.db.patch(changeRequestId, { state });
  },
});
