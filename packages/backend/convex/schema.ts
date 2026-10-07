import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const channel = v.union(v.literal("sms"), v.literal("whatsapp"), v.literal("email"), v.literal("portal"), v.literal("form"));

export const memberRole = v.union(
  v.literal("admin"), // agency admin
  v.literal("staff"), // agency staff
  v.literal("owner"), // customer owner
  v.literal("member"), // customer member
);

export const productKind = v.union(v.literal("astro-static"), v.literal("astro-emdash"));

export const changeRequestState = v.union(
  v.literal("received"),
  v.literal("queued"), // issue created, waiting for agent
  v.literal("in_progress"), // agent working
  v.literal("preview_ready"), // preview sent to customer
  v.literal("revising"), // customer feedback relayed to agent
  v.literal("approved"),
  v.literal("deployed"),
  v.literal("needs_human"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

export default defineSchema({
  // ── Tenancy ───────────────────────────────────────────────────────────
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    kind: v.union(v.literal("agency"), v.literal("customer")),
    status: v.union(v.literal("prospect"), v.literal("onboarding"), v.literal("active"), v.literal("paused"), v.literal("churned")),
    stripeCustomerId: v.optional(v.string()),
    planId: v.optional(v.id("plans")),
  })
    .index("by_slug", ["slug"])
    .index("by_kind", ["kind"]),

  /** Links a Better Auth user (component table) to an organization. */
  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    role: memberRole,
  })
    .index("by_user", ["userId"])
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  /** Phone numbers / emails we accept requests from, per organization. */
  channelIdentities: defineTable({
    orgId: v.id("organizations"),
    userId: v.optional(v.string()),
    channel,
    address: v.string(), // E.164 phone or lowercase email
    verified: v.boolean(),
  }).index("by_channel_address", ["channel", "address"]),

  // ── Sites ─────────────────────────────────────────────────────────────
  sites: defineTable({
    orgId: v.id("organizations"),
    slug: v.string(), // repo = site-<slug>, Worker = site-<slug>
    name: v.string(),
    productKind,
    repo: v.optional(v.string()), // owner/name
    workerName: v.optional(v.string()),
    productionUrl: v.optional(v.string()),
    coreVersion: v.optional(v.string()), // @agency-manager/astro-core version on main
    notifyEmail: v.optional(v.string()), // where contact-form submissions are sent
    provisionError: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("building"), v.literal("live"), v.literal("paused"), v.literal("archived")),
  })
    .index("by_org", ["orgId"])
    .index("by_slug", ["slug"])
    .index("by_repo", ["repo"]),

  domains: defineTable({
    siteId: v.id("sites"),
    hostname: v.string(),
    mode: v.union(v.literal("byo-zone"), v.literal("byo-cname"), v.literal("registered")),
    status: v.union(
      v.literal("pending_nameservers"),
      v.literal("pending_dns"),
      v.literal("pending_certificate"),
      v.literal("active"),
      v.literal("error"),
      v.literal("removed"),
    ),
    cloudflareZoneId: v.optional(v.string()),
    customHostnameId: v.optional(v.string()),
    nameservers: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),
    lastError: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_hostname", ["hostname"]),

  deployments: defineTable({
    siteId: v.id("sites"),
    environment: v.union(v.literal("preview"), v.literal("production")),
    url: v.string(),
    commitSha: v.string(),
    prNumber: v.optional(v.number()),
    workerVersionId: v.optional(v.string()),
    coreVersion: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("failure")),
  }).index("by_site", ["siteId"]),

  // ── Base package releases & rollouts ──────────────────────────────────
  releases: defineTable({
    packageName: v.string(),
    version: v.string(),
    notes: v.optional(v.string()),
  }).index("by_package_version", ["packageName", "version"]),

  rollouts: defineTable({
    releaseId: v.id("releases"),
    siteId: v.id("sites"),
    wave: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("pr_open"),
      v.literal("awaiting_approval"),
      v.literal("merged"),
      v.literal("held"),
      v.literal("failed"),
    ),
    prNumber: v.optional(v.number()),
    visualDiffSignature: v.optional(v.string()),
  })
    .index("by_release", ["releaseId"])
    .index("by_site", ["siteId"]),

  // ── Change requests & messaging ───────────────────────────────────────
  changeRequests: defineTable({
    orgId: v.id("organizations"),
    siteId: v.id("sites"),
    source: channel,
    summary: v.string(),
    body: v.string(),
    state: changeRequestState,
    tier: v.union(v.literal("content"), v.literal("code")),
    kind: v.optional(v.union(v.literal("change"), v.literal("migrate"))), // default "change"
    agent: v.union(v.literal("claude"), v.literal("codex")),
    replyToken: v.string(), // per-request token so replies map to the right request
    issueNumber: v.optional(v.number()),
    prNumber: v.optional(v.number()),
    previewUrl: v.optional(v.string()),
    iterations: v.number(),
    requestedBy: v.optional(v.string()),
    lastError: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_org", ["orgId"])
    .index("by_state", ["state"])
    .index("by_reply_token", ["replyToken"])
    .index("by_site_issue", ["siteId", "issueNumber"]),

  messages: defineTable({
    orgId: v.optional(v.id("organizations")),
    siteId: v.optional(v.id("sites")),
    changeRequestId: v.optional(v.id("changeRequests")),
    prospectId: v.optional(v.id("prospects")),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    channel,
    from: v.string(),
    to: v.string(),
    subject: v.optional(v.string()),
    body: v.string(),
    externalId: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_change_request", ["changeRequestId"])
    .index("by_external_id", ["externalId"]),

  // ── Billing ───────────────────────────────────────────────────────────
  plans: defineTable({
    name: v.string(),
    monthlyRequests: v.number(),
    codeRequestWeight: v.number(), // a code change counts as N requests
    stripePriceId: v.optional(v.string()),
    setupFeePriceId: v.optional(v.string()),
    active: v.boolean(),
  }),

  subscriptions: defineTable({
    orgId: v.id("organizations"),
    planId: v.id("plans"),
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_stripe_id", ["stripeSubscriptionId"]),

  usage: defineTable({
    orgId: v.id("organizations"),
    period: v.string(), // "2026-10"
    requests: v.number(),
  }).index("by_org_period", ["orgId", "period"]),

  // ── Prospecting ───────────────────────────────────────────────────────
  prospects: defineTable({
    name: v.string(),
    category: v.string(),
    city: v.string(),
    region: v.string(),
    osmId: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    auditScore: v.optional(v.number()), // 0 (modern) … 100 (very outdated)
    auditFindings: v.optional(v.array(v.string())),
    mockupStorageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("discovered"),
      v.literal("audited"),
      v.literal("mockup_ready"),
      v.literal("approved"),
      v.literal("contacted"),
      v.literal("replied"),
      v.literal("converted"),
      v.literal("rejected"),
    ),
    orgId: v.optional(v.id("organizations")),
  })
    .index("by_status", ["status"])
    .index("by_osm_id", ["osmId"]),

  outreach: defineTable({
    prospectId: v.id("prospects"),
    email: v.string(),
    subject: v.string(),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("bounced"), v.literal("replied"), v.literal("opted_out")),
    sentAt: v.optional(v.number()),
  }).index("by_prospect", ["prospectId"]),

  suppressionList: defineTable({
    email: v.string(),
    reason: v.string(),
  }).index("by_email", ["email"]),

  // ── Audit ─────────────────────────────────────────────────────────────
  auditLog: defineTable({
    actor: v.string(), // user id, "system", "github", "agent:claude" …
    action: v.string(),
    target: v.optional(v.string()),
    data: v.optional(v.any()),
  }).index("by_target", ["target"]),
});
