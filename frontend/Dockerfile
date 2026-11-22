# ==============================================================================
# SWEETHOME V2 - NEXT.JS FRONTEND DOCKERFILE (SH-21)
# Node 24 LTS Alpine (Baseline: .nvmrc & SweetHome_Techstack.docx)
# ==============================================================================

FROM node:24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# 1. Install dependencies
COPY package.json ./
RUN npm install --no-audit --no-fund

# 2. Copy source code & bake NEXT_PUBLIC_* build arguments
COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_USE_MOCK=false
ARG NEXT_PUBLIC_ENABLE_PAYMENT_SIMULATOR=false

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK
ENV NEXT_PUBLIC_ENABLE_PAYMENT_SIMULATOR=$NEXT_PUBLIC_ENABLE_PAYMENT_SIMULATOR
ENV NEXT_TELEMETRY_DISABLED=1

# 3. Build Next.js production bundle
RUN npm run build

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM node:24-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat wget

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["npm", "run", "start"]
