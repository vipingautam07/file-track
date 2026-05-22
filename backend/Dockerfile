# ──────────────────────────────────────────────────────────────────
# Backend Dockerfile — Kripanidhi Legal API
# Node 20 LTS Alpine, non-root user, production-optimised
# ──────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base

# Create non-root user & group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy manifests first for layer-cache efficiency
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Create logs directory with correct ownership
RUN mkdir -p logs && chown appuser:appgroup logs

# Drop to non-root
USER appuser

EXPOSE 5000

# Lightweight health check using wget (Alpine has wget by default)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
