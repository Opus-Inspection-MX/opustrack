# 1. Install dependencies and build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --production=false
COPY . .
RUN npm run build

# 2. Production image
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "dist/main.js"]