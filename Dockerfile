# Fullscript Scraper Service - Docker Image
# Based on Railway-optimized Node.js + Playwright setup

# Use official Node.js LTS image with Playwright dependencies
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Install Playwright browsers
RUN npx playwright install chromium

# Remove dev dependencies and source files (save space)
RUN rm -rf src tsconfig.json

# Expose port (Railway will override this)
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Run the server
CMD ["node", "dist/server.js"]
