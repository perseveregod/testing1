# Haven: production image for any container host (Fly.io, Railway, Render, a VPS).
# Mount a volume at /data if you use the local store instead of Supabase.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HAVEN_DATA_DIR=/data
RUN addgroup -S haven && adduser -S haven -G haven && mkdir -p /data && chown haven:haven /data
COPY --from=build --chown=haven:haven /app/.next/standalone ./
COPY --from=build --chown=haven:haven /app/.next/static ./.next/static
COPY --from=build --chown=haven:haven /app/public ./public
USER haven
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
