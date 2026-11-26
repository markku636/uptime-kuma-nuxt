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
# visual-diff checker 需要真瀏覽器；runtime 必須包含 Chromium 與其系統函式庫。
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates fonts-liberation fonts-noto-color-emoji \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 libgbm1 \
      libasound2 libxss1 libxrandr2 libx11-xcb1 libxcomposite1 libxcursor1 \
      libxdamage1 libxi6 libxtst6 libcups2 libcairo2 libpango-1.0-0 \
      libdbus-1-3 libdrm2 libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NODE_OPTIONS=--max-old-space-size=512 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Include the complete locked migration dependency graph; migrations are a separate Job.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
# 瀏覽器放在固定的 PLAYWRIGHT_BROWSERS_PATH，讓 node 使用者也能讀取。
RUN npx playwright install chromium && chmod -R a+rX /ms-playwright
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
