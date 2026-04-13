'use strict';

/**
 * Template: Dockerfile for a generic Node.js backend
 */
function dockerfileTemplate({ port, entrypoint, nodeVersion }) {
  return `# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────
#  shard-deploy generated Dockerfile
#  Generated: ${new Date().toISOString()}
# ─────────────────────────────────────────────

FROM node:${nodeVersion}-alpine AS base
WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

EXPOSE ${port}

CMD ${JSON.stringify(entrypoint.command)}
`;
}

/**
 * Template: docker-compose.yml
 */
function dockerComposeTemplate({ appName, port }) {
  return `# ─────────────────────────────────────────────
#  shard-deploy generated docker-compose.yml
#  Generated: ${new Date().toISOString()}
# ─────────────────────────────────────────────

version: "3.9"

services:
  ${appName}:
    build: .
    container_name: ${appName}
    restart: unless-stopped
    ports:
      - "\${PORT:-${port}}:${port}"
    environment:
      - NODE_ENV=production
      - PORT=${port}
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:${port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
`;
}

/**
 * Template: docker-compose.yml with nginx
 */
function dockerComposeNginxTemplate({ appName, port }) {
  return `# ─────────────────────────────────────────────
#  shard-deploy generated docker-compose.yml (with nginx)
#  Generated: ${new Date().toISOString()}
# ─────────────────────────────────────────────

version: "3.9"

services:
  ${appName}:
    build: .
    container_name: ${appName}
    restart: unless-stopped
    expose:
      - "${port}"
    environment:
      - NODE_ENV=production
      - PORT=${port}
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:${port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  nginx:
    image: nginx:stable-alpine
    container_name: ${appName}-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - ${appName}
`;
}

/**
 * Template: nginx.conf reverse proxy
 */
function nginxConfTemplate({ appName, port }) {
  return `# ─────────────────────────────────────────────
#  shard-deploy generated nginx.conf
#  Generated: ${new Date().toISOString()}
# ─────────────────────────────────────────────

upstream ${appName}_backend {
    server ${appName}:${port};
}

server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass         http://${appName}_backend;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    location /health {
        access_log off;
        proxy_pass http://${appName}_backend/health;
    }
}
`;
}

/**
 * Template: .dockerignore
 */
function dockerignoreTemplate() {
  return `# shard-deploy generated .dockerignore
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.env
.env.*
!.env.example
*.log
.git
.gitignore
.DS_Store
coverage
.nyc_output
dist
build
*.bak
*.md
`;
}

module.exports = {
  dockerfileTemplate,
  dockerComposeTemplate,
  dockerComposeNginxTemplate,
  nginxConfTemplate,
  dockerignoreTemplate,
};
