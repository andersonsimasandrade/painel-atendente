# Imagem de produção do painel (Next.js 14 em modo standalone).
#
# As variáveis de ambiente são lidas em TEMPO DE EXECUÇÃO, não no build — então
# você pode construir a imagem uma vez e trocar as chaves depois, no painel do
# EasyPanel/Docker, sem reconstruir nada.
#
# Build:  docker build -t painel-atendente .
# Rodar:  docker run -p 3000:3000 --env-file .env painel-atendente
#
# Precisa de internet durante o build: o Next baixa as fontes do Google.

# ── 1. Dependências ────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. Build ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 3. Imagem final (só o necessário para rodar) ───────────────────────────
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Não roda como root.
USER node

EXPOSE 3000
CMD ["node", "server.js"]
