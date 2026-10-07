import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type QueryCtx } from "./_generated/server";

/** Hostnames allowed to post forms for a site: production URL, active domains, and its workers.dev previews. */
export async function isAllowedOrigin(ctx: QueryCtx, site: Doc<"sites">, origin: string | null): Promise<boolean> {
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (site.productionUrl && new URL(site.productionUrl).hostname === host) return true;
  if (site.workerName && host.endsWith(".workers.dev") && host.includes(site.workerName)) return true;
  const domains = await ctx.db.query("domains").withIndex("by_site", (q) => q.eq("siteId", site._id)).collect();
  return domains.some((d) => d.status === "active" && (d.hostname === host || `www.${d.hostname}` === host));
}

export const submit = internalMutation({
  args: {
    siteId: v.string(),
    origin: v.union(v.string(), v.null()),
    fields: v.record(v.string(), v.string()),
  },
  handler: async (ctx, { siteId, origin, fields }) => {
    const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", siteId)).first();
    if (!site || !(await isAllowedOrigin(ctx, site, origin))) return { ok: false as const, status: 403 };

    const from = fields.email ?? fields.phone ?? "unknown";
    const body = Object.entries(fields).map(([k, val]) => `${k}: ${val}`).join("\n");
    await ctx.db.insert("messages", {
      orgId: site.orgId,
      siteId: site._id,
      direction: "inbound",
      channel: "form",
      from,
      to: site.slug,
      subject: `Website message from ${fields.name ?? from}`,
      body,
    });
    if (site.notifyEmail) {
      await ctx.scheduler.runAfter(0, internal.email.transport.send, {
        to: site.notifyEmail,
        subject: `New website message from ${fields.name ?? from}`,
        text: `${body}\n\n— Sent from your website contact form`,
        replyTo: fields.email,
      });
    }
    return { ok: true as const, status: 200 };
  },
});
