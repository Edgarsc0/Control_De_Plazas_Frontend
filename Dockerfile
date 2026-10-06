# --- Dependencias ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- Build (las NEXT_PUBLIC_* se compilan dentro del bundle desde .env) ---
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Runtime mínimo (output: standalone) ---
FROM node:22-alpine
WORKDIR /app
# Alpine no trae tzdata: sin esto, TZ= en docker-compose no tiene efecto y
# los logs de la app salen en UTC en vez de la hora del servidor.
RUN apk add --no-cache tzdata
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
