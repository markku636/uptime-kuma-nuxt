FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /workspace

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* ./
RUN yarn --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .

# Generate Prisma Client with dummy DATABASE_URL (not used at runtime)
ARG DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate

# Build the application
RUN yarn build

# Production image, copy all the files and run nuxt
FROM base AS runner
WORKDIR /workspace

ENV NODE_ENV=production

# Install PostgreSQL client for database initialization
RUN apk add --no-cache postgresql-client

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# Copy built assets
COPY --from=builder /workspace/.output ./.output
COPY --from=builder /workspace/node_modules/.prisma ./node_modules/.prisma
# Copy prisma schema and init SQL for migrations
COPY --from=builder /workspace/prisma ./prisma
# Copy @prisma/client for CLI operations
COPY --from=builder /workspace/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /workspace/node_modules/prisma ./node_modules/prisma
# Copy @prisma/engines for migrations
COPY --from=builder /workspace/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /workspace/node_modules/@prisma/engines-version ./node_modules/@prisma/engines-version

# Copy entrypoint script
COPY --from=builder /workspace/docker-entrypoint.sh ./docker-entrypoint.sh

# Make entrypoint executable and change ownership
USER root
RUN chmod +x ./docker-entrypoint.sh && chown nuxtjs:nodejs ./docker-entrypoint.sh

USER nuxtjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./docker-entrypoint.sh"]
