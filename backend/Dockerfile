# ==============================================================================
# SWEETHOME V2 - NESTJS BACKEND DOCKERFILE (SH-21)
# Node 24 LTS Alpine (Baseline: .nvmrc & SweetHome_Techstack.docx)
# ==============================================================================

FROM node:24-alpine AS builder

WORKDIR /app

# Native build dependencies for bcrypt & Prisma 7 engines on Alpine musl
RUN apk add --no-cache openssl libc6-compat python3 make g++

# 1. Install dependencies
COPY package.json ./
RUN npm install --no-audit --no-fund

# 2. Generate Prisma Client (build-time placeholder URL; real URL injected at runtime)
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sweethome_db?schema=public" npx prisma generate

# 3. Compile NestJS application
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM node:24-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Auto-run Prisma migrations + idempotent seed data before starting NestJS server
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main"]
