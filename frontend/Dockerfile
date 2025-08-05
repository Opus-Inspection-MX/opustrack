# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json next.config.js ./
COPY public ./public
COPY src ./src
RUN npm install
RUN npm run build

# Run stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]