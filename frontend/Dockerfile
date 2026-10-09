# Stage 1: build the Vite app into /app/dist.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: nginx serves the static build — no Node, source or node_modules here.
# The server config is mounted by docker-compose.yml from infrastructure/nginx/default.conf.
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
