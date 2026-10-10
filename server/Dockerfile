# =============================================================================
# DOCKERFILE - HOVY BACKEND API (Node.js 22 LTS / Alpine Linux)
# =============================================================================

# Etapa 1: Base liviana y optimizada para producción
FROM node:22-alpine AS base

# Definir directorio de trabajo
WORKDIR /app

# Instalar dependencias necesarias para healthcheck
RUN apk add --no-cache wget

# Copiar manifiestos de dependencias primero para aprovechar la caché de capas Docker
COPY package.json package-lock.json ./

# Instalar únicamente dependencias de producción
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el código fuente de la aplicación
COPY src ./src

# Asignar propiedad de los archivos al usuario no privilegiado 'node'
RUN chown -R node:node /app

# Ejecutar como usuario sin privilegios por seguridad
USER node

# Definir variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=4000

# Exponer el puerto del servidor
EXPOSE 4000

# Healthcheck nativo de Docker utilizando el endpoint /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Comando de inicio del servidor
CMD ["node", "src/server.js"]
