# =============================================================================
# ETAPA 1: Compilar el Frontend React (Vite)
# =============================================================================
FROM node:22-alpine AS client-builder
WORKDIR /app

# Copiar manifiestos y dependencias del cliente
COPY client/package*.json ./client/
RUN cd client && npm ci

# Copiar código del cliente y utilidades compartidas del backend
COPY client ./client
COPY server/src/utils ./server/src/utils

# Variables de compilación del frontend
ENV VITE_API_URL=/api
ENV VITE_SUPABASE_URL=https://kzfziqdmtvrcwotemvyj.supabase.co
ENV VITE_SUPABASE_ANON_KEY=sb_publishable_6iEe3FDH5iTXQqRou3E4qQ_1DFCACJd

# Compilar frontend para producción
RUN cd client && npm run build

# =============================================================================
# ETAPA 2: Servidor Node.js Express de Producción
# =============================================================================
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache wget

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/src ./src
COPY --from=client-builder /app/client/dist ./public

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "src/server.js"]
