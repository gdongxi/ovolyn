# Node 22+ is required by the x402 SDK; the image also carries the Circle CLI,
# which is the only way to reach an Agent Stack wallet.
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json .npmrc* ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts ./
COPY lib ./lib
COPY services ./services
COPY cli ./cli

# Both the ledger and the CLI's device session must outlive the container.
VOLUME ["/app/data", "/root/.circle-cli"]
EXPOSE 3000 4021 4022 4023 4024
CMD ["npm", "run", "start"]
