# 1. build image
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./           # copy package.json and package-lock.json
COPY tsconfig*.json ./          # copy tsconfig files
COPY nest-cli.json ./           # copy nest-cli config if present
COPY prisma ./prisma           # copy prisma folder
COPY src ./src                 # copy source code
RUN npm ci                     # installs both deps & devDeps
RUN npm run build              # outputs to whatever outDir you’ve configured

# 2. production image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma  # if you need prisma at runtime
USER 1001                        # or whatever non-root you prefer
EXPOSE 8000
CMD ["node", "dist/main.js"]