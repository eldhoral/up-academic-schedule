# Production image for the krs-scheduling Next.js app.
#
# Three stages:
#   deps    — resolves node_modules from the lockfile (rebuilds only when those change)
#   builder — runs `next build` with output: standalone -> .next/standalone
#   runner  — copies just the standalone server, static assets and public files,
#             runs as the unprivileged `node` user
#
# Build:  docker build -t krs-scheduling .
# Run:    docker run --rm -p 3000:3000 --env-file .env krs-scheduling

# --- deps: install dependencies from the lockfile -----------------------------
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the app ---------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# node_modules first (from deps, cacheable), then the source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the browser bundle at build time — they are
# NOT runtime-configurable, so pass them here (server vars can still be supplied
# with `docker run --env-file .env` and need no rebuild):
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
#     -t krs-scheduling .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}
RUN npm run build

# --- runner: minimal runtime image ----------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The traced server + its pruned node_modules. server.js listens on PORT/HOSTNAME.
COPY --from=builder --chown=node:node /app/.next/standalone ./
# Static assets are not copied by standalone itself; server.js serves them from these paths.
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
