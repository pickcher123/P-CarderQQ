# 使用官方 Node.js 映像檔
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# 安裝依賴
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci || npm install --legacy-peer-deps

# 建置專案
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 執行環境
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]

