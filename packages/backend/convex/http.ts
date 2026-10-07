import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { verifyEdgeRequest } from "./lib/edgeAuth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

http.route({
  path: "/edge/form",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    if (!(await verifyEdgeRequest(request, body))) return new Response("Unauthorized", { status: 401 });
    const { siteId, origin, fields } = JSON.parse(body);
    const result = await ctx.runMutation(internal.forms.submit, { siteId, origin, fields });
    return new Response(null, { status: result.status });
  }),
});

http.route({
  path: "/edge/email",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    if (!(await verifyEdgeRequest(request, body))) return new Response("Unauthorized", { status: 401 });
    const { from, to, subject, text, messageId } = JSON.parse(body);
    await ctx.runMutation(internal.inbound.email, { from, to, subject, text, messageId });
    return new Response(null, { status: 204 });
  }),
});

export default http;
