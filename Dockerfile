# Local development image for the Next.js server.
#
# Debian slim, not Alpine: `bcrypt` is a native module and musl has no prebuilt
# binaries for it, so Alpine would need a full C toolchain in the image.
# `openssl` is required by Prisma's query engine.
#
# Vercel does not use this file — it builds the app itself from package.json.

FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# deps — install once and cache; the lockfile is the only invalidation trigger
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci` runs postinstall (prisma generate), which needs the schema above.
RUN npm ci

# ---------------------------------------------------------------------------
# dev — hot reload. Source arrives as a bind mount from docker-compose.yml;
#       node_modules stays in an anonymous volume so the Linux binaries built
#       here are never shadowed by the host's macOS ones.
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev:next"]

# ---------------------------------------------------------------------------
# builder / runner — production-like image, for checking the container build
#       locally. NEXT_OUTPUT=standalone is read by next.config.ts and is only
#       ever set here, so Vercel's build stays untouched.
# ---------------------------------------------------------------------------
FROM base AS builder
ENV NODE_ENV=production
ENV NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
