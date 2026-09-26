# Stage 1: Build stage
FROM node:22-slim AS builder
WORKDIR /workspace

# Install shared/job-core dependencies
COPY shared/job-core/package*.json ./shared/job-core/
RUN cd shared/job-core && npm ci

# Copy shared/job-core sources
COPY shared/job-core/ ./shared/job-core/

# Install hosted-mcp dependencies
COPY hosted-mcp/package*.json ./hosted-mcp/
RUN cd hosted-mcp && npm ci

# Copy hosted-mcp sources and build self-contained bundle
COPY hosted-mcp/ ./hosted-mcp/
RUN cd hosted-mcp && npm run build

# Stage 2: Runtime stage
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /workspace/hosted-mcp/package.json ./package.json
COPY --from=builder /workspace/hosted-mcp/dist ./dist

USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
