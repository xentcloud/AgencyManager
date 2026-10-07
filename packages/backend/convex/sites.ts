import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { productKind } from "./schema";
import { requireAgency, requireOrgAccess } from "./lib/access";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAccess(ctx, orgId);
    return ctx.db.query("sites").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
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
