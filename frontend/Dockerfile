# ──────────────────────────────────────────────────────────────────
# Frontend Dockerfile — Kripanidhi Legal (React + Vite)
# Multi-stage: build with Node → serve with Nginx Alpine
# ──────────────────────────────────────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Pass public env vars at build time (non-secret values only)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built SPA
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our hardened nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx runs as www-data (uid 101) by default on Alpine — do NOT run as root
# nginx master process needs to bind port 80, workers drop to www-data
# We expose 80 and let docker-compose set resource limits

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
