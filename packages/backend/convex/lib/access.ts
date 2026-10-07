import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";

export type Viewer = {
  userId: string;
  email: string;
  name: string;
  memberships: Doc<"memberships">[];
  isAgency: boolean; // admin or staff of the agency org
};

export async function getViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return null;
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  return {
    userId: user._id,
    email: user.email,
    name: user.name,
    memberships,
    isAgency: memberships.some((m) => m.role === "admin" || m.role === "staff"),
  };
}

export async function requireViewer(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) throw new ConvexError("Not signed in");
  return viewer;
}

export async function requireAgency(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (!viewer.isAgency) throw new ConvexError("Agency staff only");
  return viewer;
}

/** Agency staff can access every org; customers only their own. */
export async function requireOrgAccess(ctx: QueryCtx, orgId: Id<"organizations">): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (viewer.isAgency || viewer.memberships.some((m) => m.orgId === orgId)) return viewer;
  throw new ConvexError("No access to this organization");
}
