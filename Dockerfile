# Multi-stage Dockerfile for Next.js app with uvx support
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Install Python and uv for uvx support
RUN apk add --no-cache python3 py3-pip curl
RUN pip3 install --break-system-packages uv

# Ensure uvx is available in PATH
ENV PATH="/root/.local/bin:$PATH"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files and generate client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Create tmp directory for MCPO config files
RUN mkdir -p .tmp && chown nextjs:nodejs .tmp

USER nextjs

EXPOSE 3000
EXPOSE 8001

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Health check for both Next.js and MCPO
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Default command for production
CMD ["node", "server.js"]

# For development mode, override with:
# docker run -v $(pwd):/app -p 3000:3000 -p 8001:8001 image npm run dev