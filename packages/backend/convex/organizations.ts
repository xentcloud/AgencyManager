import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAgency, requireOrgAccess, requireViewer } from "./lib/access";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Customers visible to the viewer: all for agency staff, own orgs for customers. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const customers = viewer.isAgency
      ? await ctx.db.query("organizations").withIndex("by_kind", (q) => q.eq("kind", "customer")).collect()
      : (await Promise.all(viewer.memberships.map((m) => ctx.db.get(m.orgId)))).filter((o) => o?.kind === "customer");
    return Promise.all(
      customers.map(async (org) => ({
        ...org!,
        siteCount: (await ctx.db.query("sites").withIndex("by_org", (q) => q.eq("orgId", org!._id)).collect()).length,
      })),
    );
  },
});

export const get = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgAccess(ctx, orgId);
    return ctx.db.get(orgId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    status: v.optional(v.union(v.literal("prospect"), v.literal("onboarding"), v.literal("active"))),
  },
  handler: async (ctx, { name, status }) => {
    const viewer = await requireAgency(ctx);
    const slug = slugify(name);
    if (!slug) throw new ConvexError("Name must contain letters or digits");
    if (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).first()) {
      throw new ConvexError(`A customer with slug "${slug}" already exists`);
    }
    const orgId = await ctx.db.insert("organizations", { name, slug, kind: "customer", status: status ?? "onboarding" });
    await ctx.db.insert("auditLog", { actor: viewer.userId, action: "org.create", target: orgId });
    return orgId;
  },
});
