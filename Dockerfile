FROM node:24.22.0-bookworm-slim AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM dependencies AS builder
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM node:24.22.0-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NODE_OPTIONS=--max-old-space-size=512
# Include the complete locked migration dependency graph; migrations are a separate Job.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.output ./.output
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=node:node /app/scripts/check-runtime.mjs ./scripts/check-runtime.mjs
COPY --from=builder --chown=node:node /app/scripts/demo-fixture.mjs ./scripts/demo-fixture.mjs
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
