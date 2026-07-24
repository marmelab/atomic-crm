# syntax=docker/dockerfile:1

# ---- builder: full devDependencies, runs `tsc && vite build` ----
FROM node:22.19.0-bookworm-slim AS builder
WORKDIR /app

# No .git exists in this build context, so husky's "prepare" script has
# nothing to attach hooks to; Playwright's install step would otherwise
# download browser binaries this stage never uses. Both skipped via their
# documented env-var escape hatches.
ENV HUSKY=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- runtime: production deps only + built output ----
FROM node:22.19.0-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HUSKY=0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY db ./db

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

USER node

# The "serve" package.json script runs `node --env-file=.env`, but no .env
# file exists in this image (EasyPanel injects real env vars into the
# process directly). Entry file invoked directly (not "npm start") so Node
# is PID 1 and receives SIGTERM directly, without delaying shutdown.
CMD ["node", "server/index.mjs"]
