# Production: Dokploy

Project **AgencyManager** (production environment) on the agency's Dokploy server. Services are separate,
not a compose stack:

| Service | Type | Image | Public URL |
|---|---|---|---|
| `postgres` | Dokploy Postgres template | `postgres:17-alpine`, db `agency_manager`, user `convex` | none (internal only) |
| `convex-backend` | Application (Docker image) | `ghcr.io/get-convex/convex-backend@sha256:d715e9ec…` | API `:3210`; HTTP actions `:3211` |
| `portal` | Application (Dockerfile `apps/portal/Dockerfile`, built from this public repo) | static SPA via nginx `:80` |
| `convex-dashboard` | Application (Docker image) | `ghcr.io/get-convex/convex-dashboard@sha256:f85cf0d0…` | `:6791` (requires the admin key) |

Backend env (set in Dokploy, never in git): `INSTANCE_NAME=agency-manager`, `INSTANCE_SECRET`,
`POSTGRES_URL=postgresql://convex:<pw>@<postgres appName>:5432`, `DO_NOT_REQUIRE_SSL=1`,
`CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`. Volume `agency-convex-data` → `/convex/data`.

Hostnames are `*.107-155-127-130.sslip.io` until `xentcloud.com` DNS records are added.

## Deploy functions
```bash
# File holds CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY (quoted: the key contains `|`).
cd packages/backend && set -a && . ~/.config/agency-manager/convex-prod.env && set +a && npx convex deploy -y
```

## Rotate the admin key
Admin keys derive from `INSTANCE_SECRET`. Change it in the backend's Dokploy env, redeploy, then regenerate:
`docker run --rm -e INSTANCE_NAME=agency-manager -e INSTANCE_SECRET=… --entrypoint ./generate_admin_key.sh <backend image>`.

## Portal
Built by Dokploy from `https://github.com/xentcloud/AgencyManager.git` (`main`), with Dockerfile `apps/portal/Dockerfile`
and the repo root as build context. Build args (public URLs): `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_SITE_URL`.
Convex `SITE_URL` must equal the portal URL (Better Auth trusted origin).
