# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:18-alpine AS build

# Increase Node.js heap so Angular build doesn't OOM on low-RAM servers
ENV NODE_OPTIONS="--max-old-space-size=1536"
ENV NODE_ENV=production

WORKDIR /app

# Copy lockfiles first — Docker caches this layer until package.json changes
COPY package.json package-lock.json ./
RUN npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps

# Copy source code
COPY . .

# Build with source maps disabled and parallelism limited (speeds up on CI servers)
RUN npx ng build --configuration production \
    --source-map=false \
    --named-chunks=false \
    --output-hashing=all

# ─── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Enable gzip compression for faster page loads
RUN echo 'gzip on; \
gzip_vary on; \
gzip_min_length 1024; \
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/x-font-ttf image/svg+xml;' \
> /etc/nginx/conf.d/gzip.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/hms-modern-app /usr/share/nginx/html

EXPOSE 72
CMD ["nginx", "-g", "daemon off;"]
