import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/** Local development seed: `npx convex run dev:seedSite '{"slug":"lemus-dental", ...}'`. Not callable from clients. */
export const seedSite = internalMutation({
  args: { orgName: v.string(), slug: v.string(), name: v.string(), productionUrl: v.string(), notifyEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (existing) return existing._id;
    let org = await ctx.db.query("organizations").filter((q) => q.eq(q.field("name"), args.orgName)).first();
    const orgId = org?._id ?? (await ctx.db.insert("organizations", {
      name: args.orgName, slug: args.slug, kind: "customer", status: "onboarding",
    }));
    return ctx.db.insert("sites", {
      orgId, slug: args.slug, name: args.name, productKind: "astro-static", workerName: `site-${args.slug}`,
      productionUrl: args.productionUrl, notifyEmail: args.notifyEmail, status: "draft",
    });
  },
});
