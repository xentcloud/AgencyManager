import PostalMime from "postal-mime";
import { sign } from "./sign";

export interface Env {
  CONVEX_SITE_URL: string;
  EDGE_SHARED_SECRET: string;
  TURNSTILE_SECRET_KEY?: string;
  FORM_LIMITER: RateLimit;
}

const MAX_FIELD = 5000;

async function postToConvex(env: Env, path: string, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  return fetch(`${env.CONVEX_SITE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-edge-timestamp": ts, "x-edge-signature": await sign(env.EDGE_SHARED_SECRET, ts, body) },
    body,
  });
}

async function verifyTurnstile(env: Env, token: string | null, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured for this deployment
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  return ((await res.json()) as { success: boolean }).success;
}

/** Plain HTML response so forms work without JavaScript. */
function page(status: number, title: string, message: string, back?: string | null) {
  const link = back ? `<p><a href="${back.replace(/"/g, "")}">Go back</a></p>` : "";
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:18px system-ui;max-width:560px;margin:15vh auto;padding:0 16px"><h1>${title}</h1><p>${message}</p>${link}`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function handleForm(request: Request, env: Env, siteId: string): Promise<Response> {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const ip = request.headers.get("cf-connecting-ip");

  const { success } = await env.FORM_LIMITER.limit({ key: `${siteId}:${ip ?? "unknown"}` });
  if (!success) return page(429, "Too many messages", "Please wait a minute and try again.", referer);

  const form = await request.formData();
  if (form.get("company_website")) return page(200, "Thanks!", "Your message was sent.", referer); // honeypot: pretend success
  if (!(await verifyTurnstile(env, form.get("cf-turnstile-response") as string | null, ip))) {
    return page(400, "Verification failed", "Please go back and try again.", referer);
  }

  const fields: Record<string, string> = {};
  for (const [k, v] of form) {
    if (typeof v === "string" && !k.startsWith("cf-") && k !== "company_website" && k !== "siteId") fields[k] = v.slice(0, MAX_FIELD);
  }
  // Convex checks the origin against the site's allowed hostnames and sends the notification email.
  const res = await postToConvex(env, "/edge/form", { siteId, origin, fields, ip });
  if (res.status === 403) return page(403, "Not allowed", "This form isn't accepted from this website.");
  if (!res.ok) return page(502, "Something went wrong", "Please call us instead, or try again later.", referer);
  return page(200, "Thanks!", "Your message was sent. We'll get back to you soon.", referer);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/f\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (match && request.method === "POST") return handleForm(request, env, match[1]!);
    if (url.pathname === "/health") return new Response("ok");
    return new Response("Not found", { status: 404 });
  },

  async email(message, env): Promise<void> {
    const parsed = await PostalMime.parse(message.raw);
    const res = await postToConvex(env, "/edge/email", {
      from: message.from,
      to: message.to,
      subject: parsed.subject ?? "",
      text: (parsed.text ?? "").slice(0, 50_000),
      messageId: parsed.messageId,
      inReplyTo: parsed.inReplyTo,
    });
    if (!res.ok) message.setReject(`Temporary failure (${res.status})`);
  },
} satisfies ExportedHandler<Env>;
