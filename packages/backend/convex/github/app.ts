"use node";
// GitHub App client (agency bot). Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM), GITHUB_APP_INSTALLATION_ID.
import { createSign } from "node:crypto";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

type AppName = "bot" | "admin";
// bot: GITHUB_APP_* (issues, PRs, merges; same App the agent workflows use).
// admin: GITHUB_ADMIN_APP_* (repo creation only; never exposed to workflows).
const ENV_PREFIX: Record<AppName, string> = { bot: "GITHUB_APP", admin: "GITHUB_ADMIN_APP" };
const cache = new Map<AppName, { token: string; expiresAt: number }>();

function appJwt(app: AppName): string {
  const appId = process.env[`${ENV_PREFIX[app]}_ID`];
  const key = process.env[`${ENV_PREFIX[app]}_PRIVATE_KEY`];
  if (!appId || !key) throw new Error(`${ENV_PREFIX[app]}_ID / _PRIVATE_KEY not configured`);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iat: now - 60, exp: now + 540, iss: appId })}`;
  // Keys are stored as single-line base64 of the PEM (multi-line values leak easily in CLI output).
  const pem = key.startsWith("-----") ? key.replace(/\\n/g, "\n") : Buffer.from(key, "base64").toString("utf8");
  const sig = createSign("RSA-SHA256").update(unsigned).sign(pem, "base64url");
  return `${unsigned}.${sig}`;
}

async function installationToken(app: AppName): Promise<string> {
  const hit = cache.get(app);
  if (hit && hit.expiresAt - Date.now() > 5 * 60_000) return hit.token;
  const id = process.env[`${ENV_PREFIX[app]}_INSTALLATION_ID`];
  if (!id) throw new Error(`${ENV_PREFIX[app]}_INSTALLATION_ID not configured`);
  const res = await fetch(`https://api.github.com/app/installations/${id}/access_tokens`, {
    method: "POST",
    headers: { authorization: `Bearer ${appJwt(app)}`, accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub installation token (${app}): ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { token: string; expires_at: string };
  cache.set(app, { token: json.token, expiresAt: Date.parse(json.expires_at) });
  return json.token;
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function gh<T = unknown>(method: string, path: string, body?: unknown, app: AppName = "bot"): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await installationToken(app)}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new GitHubError(res.status, `GitHub ${method} ${path}: ${res.status} ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Open the work-queue issue the site repo's agent workflow listens for. */
export const createIssue = internalAction({
  args: { changeRequestId: v.id("changeRequests") },
  handler: async (ctx, { changeRequestId }) => {
    const cr = await ctx.runQuery(internal.changeRequests.forGitHub, { changeRequestId });
    if (!cr.repo) throw new Error(`Site ${cr.siteSlug} has no repo`);
    const issue = await gh<{ number: number; html_url: string }>("POST", `/repos/${cr.repo}/issues`, {
      title: cr.summary,
      body: `${cr.body}\n\n---\nSource: ${cr.source} · Request \`${cr.replyToken}\` · Opened by the agency portal.`,
      labels: [cr.kind === "migrate" ? "type:migrate" : "type:change", `agent:${cr.agent}`],
    });
    await ctx.runMutation(internal.changeRequests.markQueued, { changeRequestId, issueNumber: issue.number });
  },
});

/** Customer feedback → `/revise` on the issue (the contract the agent workflow listens for). */
export const postRevision = internalAction({
  args: { changeRequestId: v.id("changeRequests"), feedback: v.string() },
  handler: async (ctx, { changeRequestId, feedback }) => {
    const cr = await ctx.runQuery(internal.changeRequests.forGitHub, { changeRequestId });
    await gh("POST", `/repos/${cr.repo}/issues/${cr.issueNumber}/comments`, { body: `/revise ${feedback}` });
  },
});

/** Approval → squash-merge the agent PR; the site's deploy workflow ships it. */
export const mergePullRequest = internalAction({
  args: { changeRequestId: v.id("changeRequests") },
  handler: async (ctx, { changeRequestId }) => {
    const cr = await ctx.runQuery(internal.changeRequests.forGitHub, { changeRequestId });
    if (!cr.prNumber) throw new Error("No pull request to merge");
    try {
      await gh("PUT", `/repos/${cr.repo}/pulls/${cr.prNumber}/merge`, { merge_method: "squash" });
    } catch (e) {
      await ctx.runMutation(internal.changeRequests.markNeedsHuman, { changeRequestId, reason: (e as Error).message });
    }
  },
});

/** Health check: `npx convex run github/app:check` lists how many repos the App installation can reach. */
export const check = internalAction({
  args: {},
  handler: async () => {
    const res = await gh<{ total_count: number }>("GET", "/installation/repositories?per_page=1");
    return { ok: true, repositories: res.total_count };
  },
});

const SITE_LABELS: [string, string, string][] = [
  ["type:change", "1d76db", "Customer change request"],
  ["type:migrate", "0e8a16", "Migrate/modernize content from an existing site"],
  ["agent:claude", "d97706", "Handled by Claude Code"],
  ["agent:codex", "10a37f", "Handled by Codex"],
  ["tier:content", "c2e0c6", "Content/data-only change"],
  ["tier:code", "5319e7", "Code change: staff review before merge"],
  ["needs-human", "b60205", "Agent stuck or failed; staff must act"],
  ["needs-info", "fbca04", "Agent asked a question"],
];

/**
 * Create `<org>/site-<slug>` from the template repo, personalize it in one commit (which triggers the
 * first production deploy, so the Worker exists before any PR preview), create labels, link the site.
 * Idempotent: re-running skips steps already done.
 */
export const provisionSite = internalAction({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    const site = await ctx.runQuery(internal.sites.forProvisioning, { siteId });
    const org = process.env.GITHUB_ORG ?? "xentcloud";
    const template = process.env.SITE_TEMPLATE_REPO ?? `${org}/site-template`;
    const subdomain = process.env.WORKERS_SUBDOMAIN;
    const name = `site-${site.slug}`;
    const repo = `${org}/${name}`;
    const productionUrl = subdomain ? `https://${name}.${subdomain}.workers.dev` : undefined;
    try {
      let exists = true;
      try {
        await gh("GET", `/repos/${repo}`, undefined, "admin");
      } catch (e) {
        if (!(e instanceof GitHubError) || e.status !== 404) throw e;
        exists = false;
      }
      if (!exists) {
        await gh("POST", `/repos/${template}/generate`, {
          owner: org, name, private: true, description: `${site.name} website, managed by the agency portal`,
        }, "admin");
      }

      // Generation is async: wait for main.
      let head: { object: { sha: string } } | undefined;
      for (let i = 0; i < 20 && !head; i++) {
        try {
          head = await gh("GET", `/repos/${repo}/git/ref/heads/main`, undefined, "admin");
        } catch {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (!head) throw new Error("Repository was created but main never appeared");

      const read = async (path: string) => {
        const f = await gh<{ content: string }>("GET", `/repos/${repo}/contents/${path}?ref=main`, undefined, "admin");
        return Buffer.from(f.content, "base64").toString("utf8");
      };
      const config = await read("site.config.ts");
      if (config.includes('id: "template"')) {
        const files = {
          "site.config.ts": config
            .replace('id: "template"', `id: "${site.slug}"`)
            .replace(/url: "[^"]*"/, `url: "${productionUrl ?? `https://${name}.workers.dev`}"`),
          "wrangler.jsonc": (await read("wrangler.jsonc")).replace('"site-template"', `"${name}"`),
          "package.json": (await read("package.json")).replace('"name": "site-template"', `"name": "${name}"`),
          "AGENTS.md": (await read("AGENTS.md"))
            .replace("- Business: (filled in at setup)", `- Business: ${site.orgName} (site: ${site.name})`)
            .replace("- Site created: (filled in at setup)", `- Site created: ${new Date().toISOString().slice(0, 10)}`),
          "README.md": `# ${name}\n\n${site.name} website, managed by the agency portal.\n\n- Content: \`src/content/*.yaml\`; theme and sections: \`site.config.ts\`.\n- Change requests arrive as issues labeled \`type:change\`; merging to \`main\` deploys.\n`,
        };
        const base = await gh<{ tree: { sha: string } }>("GET", `/repos/${repo}/git/commits/${head.object.sha}`, undefined, "admin");
        const tree = await gh<{ sha: string }>("POST", `/repos/${repo}/git/trees`, {
          base_tree: base.tree.sha,
          tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
        }, "admin");
        const commit = await gh<{ sha: string }>("POST", `/repos/${repo}/git/commits`, {
          message: `Set up ${name}`, tree: tree.sha, parents: [head.object.sha],
        }, "admin");
        await gh("PATCH", `/repos/${repo}/git/refs/heads/main`, { sha: commit.sha }, "admin");
      }

      for (const [label, color, description] of SITE_LABELS) {
        try {
          await gh("POST", `/repos/${repo}/labels`, { name: label, color, description }, "admin");
        } catch (e) {
          if (!(e instanceof GitHubError) || e.status !== 422) throw e; // 422 = already exists
        }
      }
      await ctx.runMutation(internal.sites.markProvisioned, { siteId, repo, productionUrl });
    } catch (e) {
      await ctx.runMutation(internal.sites.markProvisionFailed, { siteId, error: (e as Error).message.slice(0, 500) });
    }
  },
});
