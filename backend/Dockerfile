# 1. build image
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./          
COPY tsconfig*.json ./         
COPY nest-cli.json ./          
COPY prisma ./prisma          
COPY src ./src                
COPY .env.production ./
RUN npm ci                    
RUN npm run build            

# 2. production image
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma  
USER 1001                       
EXPOSE 8000
CMD ["node", "dist/src/main.js"]