# Cloud Run container for the CarbonLedger backend (T-043, PRD M-3).
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Install backend workspace dependencies first for layer caching.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
RUN npm ci --workspace carbonledger-backend --omit=dev

# Application code and the offline data assets (factor library, golden, demo).
COPY backend/src backend/src
COPY data/factors data/factors
COPY data/golden data/golden
COPY data/demo data/demo

# Run as the non-root user provided by the base image.
USER node
CMD ["node", "backend/src/server.js"]
