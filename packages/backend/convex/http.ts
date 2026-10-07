import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { verifyEdgeRequest } from "./lib/edgeAuth";
import { hmacSha256Hex, safeEqual } from "./lib/hmac";

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

// GitHub App webhook (agency bot): issues, pull_request, deployment_status.
http.route({
  path: "/github/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const sig = request.headers.get("x-hub-signature-256") ?? "";
    if (!secret || !safeEqual(sig, `sha256=${await hmacSha256Hex(secret, body)}`)) {
      return new Response("Invalid signature", { status: 401 });
    }
    const event = request.headers.get("x-github-event") ?? "";
    const p = JSON.parse(body);
    const repo: string | undefined = p.repository?.full_name;
    if (event === "ping" || !repo) return new Response("ok");
    await ctx.runMutation(internal.githubEvents.handle, {
      event,
      repo,
      action: p.action,
      issueNumber: event === "issues" ? p.issue?.number : undefined,
      prNumber: p.pull_request?.number,
      branch: p.pull_request?.head?.ref ?? p.deployment?.ref,
      merged: p.pull_request?.merged,
      label: p.label?.name,
      labels: p.pull_request?.labels?.map((l: { name: string }) => l.name),
      prBody: p.pull_request?.body ?? undefined,
      environment: p.deployment?.environment,
      deployState: p.deployment_status?.state,
      url: p.deployment_status?.environment_url || undefined,
      sha: p.deployment?.sha,
    });
    return new Response("ok");
  }),
});

export default http;
