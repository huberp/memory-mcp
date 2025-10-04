# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Set environment variables
ENV NODE_ENV=production
ENV MONGODB_URI=mongodb://mongodb:27017
ENV MONGODB_DATABASE=memory_mcp
ENV LOG_LEVEL=info

# Expose port (if needed for future HTTP interface)
# EXPOSE 3000

# Health check (optional - can be removed if not needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('mongodb').MongoClient.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS: 5000}).then(c => c.close()).catch(() => process.exit(1))"

# Run the MCP server
CMD ["node", "build/index.js"]
