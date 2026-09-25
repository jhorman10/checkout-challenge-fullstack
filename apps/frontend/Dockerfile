# Multi-stage build: builder → runtime
# Builder stage: install deps and build Vite production bundle
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: serve static files with nginx (non-root)
FROM nginx:alpine AS runtime

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginxjs && \
    adduser -S nginxjs -u 1001 -G nginxjs

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Adjust permissions for non-root nginx
RUN chown -R nginxjs:nginxjs /usr/share/nginx/html && \
    chown -R nginxjs:nginxjs /var/cache/nginx && \
    chown -R nginxjs:nginxjs /var/log/nginx && \
    chown -R nginxjs:nginxjs /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginxjs:nginxjs /var/run/nginx.pid

# Switch to non-root user
USER nginxjs

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4173/ || exit 1

CMD ["nginx", "-g", "daemon off;"]