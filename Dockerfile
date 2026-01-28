# Multi-stage Dockerfile for Vikala Discord Bot

# Stage 1: Build stage
FROM oven/bun:1.1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install all dependencies (including dev dependencies for build)
RUN bun install --frozen-lockfile

# Copy source code and configuration
COPY . .

# Build the TypeScript project
RUN bun run build

# Stage 2: Production stage
FROM oven/bun:1.1-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user
RUN addgroup -g 1001 -S vikala && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G vikala -g vikala vikala && \
    chown -R vikala:vikala /app

# Switch to non-root user
USER vikala

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the bot
CMD ["bun", "run", "start"]

# Stage 3: Development stage
FROM oven/bun:1.1-alpine AS development

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json bun.lockb* ./

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start in development mode
CMD ["bun", "run", "dev"]
