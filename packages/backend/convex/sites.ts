import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { productKind } from "./schema";
import { requireAgency, requireOrgAccess, requireViewer } from "./lib/access";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAccess(ctx, orgId);
    const org = process.env.GITHUB_ORG ?? "xentcloud";
    const sites = await ctx.db.query("sites").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
    return sites.map((s) => ({ ...s, suggestedRepo: `${org}/site-${s.slug}` }));
  },
});

/** Sites the viewer can request changes on. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const sites = await ctx.db.query("sites").collect();
    const orgIds = new Set(viewer.memberships.map((m) => m.orgId));
    return sites.filter((s) => viewer.isAgency || orgIds.has(s.orgId));
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAgency(ctx);
    const sites = await ctx.db.query("sites").order("desc").collect();
    return Promise.all(sites.map(async (s) => ({ ...s, orgName: (await ctx.db.get(s.orgId))?.name ?? "?" })));
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    productKind: v.optional(productKind),
  },
  handler: async (ctx, args) => {
    const viewer = await requireAgency(ctx);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug)) throw new ConvexError("Slug must be lowercase-with-dashes");
    if (await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first()) {
      throw new ConvexError(`Site "${args.slug}" already exists`);
    }
    const siteId = await ctx.db.insert("sites", {
      orgId: args.orgId,
      name: args.name,
      slug: args.slug,
      productKind: args.productKind ?? "astro-static",
      workerName: `site-${args.slug}`,
      status: "draft",
    });
    await ctx.db.insert("auditLog", { actor: viewer.userId, action: "site.create", target: siteId });
    return siteId;
  },
});

export const connect = mutation({
  args: {
    siteId: v.id("sites"),
    repo: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    notifyEmail: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    const viewer = await requireAgency(ctx);
    if (fields.repo && !/^[\w.-]+\/[\w.-]+$/.test(fields.repo)) throw new ConvexError("Repo must look like owner/name");
    if (fields.productionUrl) {
      try { new URL(fields.productionUrl); } catch { throw new ConvexError("Production URL must be a full URL"); }
    }
    await ctx.db.patch(siteId, Object.fromEntries(Object.entries(fields).filter(([, val]) => val !== undefined)));
    await ctx.db.insert("auditLog", { actor: viewer.userId, action: "site.connect", target: siteId, data: fields });
  },
});

/** Agency only: create the site's GitHub repo from the template and deploy it. */
export const provisionRepo = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const viewer = await requireAgency(ctx);
    const site = await ctx.db.get(siteId);
    if (!site) throw new ConvexError("Site not found");
    if (site.repo) throw new ConvexError(`Already connected to ${site.repo}`);
    if (site.status === "building") throw new ConvexError("Repository is already being created");
    await ctx.db.patch(siteId, { status: "building", provisionError: undefined });
    await ctx.db.insert("auditLog", { actor: viewer.userId, action: "site.provision", target: siteId });
    await ctx.scheduler.runAfter(0, internal.github.app.provisionSite, { siteId });
  },
});

export const forProvisioning = internalQuery({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.db.get(siteId);
    if (!site) throw new Error("Site not found");
    return site;
  },
});

export const markProvisioned = internalMutation({
  args: { siteId: v.id("sites"), repo: v.string(), productionUrl: v.optional(v.string()) },
  handler: async (ctx, { siteId, repo, productionUrl }) => {
    // Status becomes "live" when the first production deployment_status webhook arrives.
    await ctx.db.patch(siteId, { repo, productionUrl, provisionError: undefined });
    await ctx.db.insert("auditLog", { actor: "github", action: "site.provisioned", target: siteId, data: { repo } });
  },
});

export const markProvisionFailed = internalMutation({
  args: { siteId: v.id("sites"), error: v.string() },
  handler: async (ctx, { siteId, error }) => {
    await ctx.db.patch(siteId, { status: "draft", provisionError: error });
  },
});
