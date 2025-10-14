# Multi-stage build for MCP server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Service account will be mounted as volume or set via environment
ENV NODE_ENV=production

# Expose health check port (optional, for fly.io)
EXPOSE 8080

# Run the MCP server
CMD ["node", "dist/index.js"]
