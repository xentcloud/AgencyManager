import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Inbound email from the edge Worker. Phase 3 routes it to a change request
 * (by the `req-<token>@` reply-to address, else by sender identity) and classifies it.
 * For now it's stored so staff see it in the portal inbox.
 */
export const email = internalMutation({
  args: {
    from: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.messageId) {
      const dup = await ctx.db.query("messages").withIndex("by_external_id", (q) => q.eq("externalId", args.messageId)).first();
      if (dup) return dup._id;
    }
    const sender = args.from.toLowerCase();
    const identity = await ctx.db
      .query("channelIdentities")
      .withIndex("by_channel_address", (q) => q.eq("channel", "email").eq("address", sender))
      .first();
    return ctx.db.insert("messages", {
      orgId: identity?.orgId,
      direction: "inbound",
      channel: "email",
      from: sender,
      to: args.to,
      subject: args.subject,
      body: args.text,
      externalId: args.messageId,
    });
  },
});
