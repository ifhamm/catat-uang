# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app

# Install backend deps first so this layer caches across code changes.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# tsx is a runtime dependency, so a full install is intentional.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 10000
CMD ["node", "dist/server.js"]
