import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, requireViewer } from "./lib/access";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    const orgs = await Promise.all(viewer.memberships.map((m) => ctx.db.get(m.orgId)));
    return {
      ...viewer,
      orgs: viewer.memberships.map((m, i) => ({ role: m.role, org: orgs[i] })),
    };
  },
});

/** True until the first agency admin exists; the portal shows a setup screen. */
export const needsBootstrap = query({
  args: {},
  handler: async (ctx) => {
    const agency = await ctx.db.query("organizations").withIndex("by_kind", (q) => q.eq("kind", "agency")).first();
    return agency === null;
  },
});

/** The first signed-in user creates the agency org and becomes its admin. */
export const bootstrapAgency = mutation({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const existing = await ctx.db.query("organizations").withIndex("by_kind", (q) => q.eq("kind", "agency")).first();
    if (existing) throw new ConvexError("Agency already set up");
    const orgId = await ctx.db.insert("organizations", {
      name: process.env.AGENCY_NAME ?? "My Agency",
      slug: "agency",
      kind: "agency",
      status: "active",
    });
    await ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "admin" });
    await ctx.db.insert("auditLog", { actor: viewer.userId, action: "agency.bootstrap", target: orgId });
    return orgId;
  },
});
