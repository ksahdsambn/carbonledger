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
# Health signal for the platform's restart policy (D-29); slim has no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/src/server.js"]
