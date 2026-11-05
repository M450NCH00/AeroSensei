# Build on a glibc base (Debian slim), not alpine/musl: Next 16's Turbopack needs
# the platform-native SWC binding, and the installed one is @next/swc-linux-x64-gnu
# (glibc). On alpine/musl it can't load (missing ld-linux-x86-64.so.2) and the
# build falls back to WASM, which Turbopack doesn't support.
FROM node:20-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so they
# must arrive as build args (docker-compose passes them via build.args), not
# just as runtime `environment:` — those come too late for the client bundle.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AI_AGENT_URL
ARG NEXT_PUBLIC_ML_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_AI_AGENT_URL=${NEXT_PUBLIC_AI_AGENT_URL}
ENV NEXT_PUBLIC_ML_API_URL=${NEXT_PUBLIC_ML_API_URL}

COPY package.json package-lock.json* ./
# Retry on transient registry resets (ECONNRESET) instead of failing the whole build
RUN npm ci --no-audit --no-fund \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 \
      --fetch-timeout=600000

COPY . ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
