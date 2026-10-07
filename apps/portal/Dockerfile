# Agency portal: static Vite build served by nginx. Build context = repo root.
FROM node:22-alpine AS build
WORKDIR /repo
RUN npm install -g pnpm@10.33.0 --no-audit --no-fund
COPY . .
RUN pnpm install --frozen-lockfile --filter portal...
# Public URLs only (no secrets); baked into the bundle.
ARG VITE_CONVEX_URL
ARG VITE_CONVEX_SITE_URL
ARG VITE_SITE_URL
RUN test -n "$VITE_CONVEX_URL" && test -n "$VITE_CONVEX_SITE_URL" \
  && pnpm --filter portal exec vite build

FROM nginx:1.29-alpine
COPY apps/portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/portal/dist /usr/share/nginx/html
EXPOSE 80
