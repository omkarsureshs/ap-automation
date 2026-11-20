# NOT BUILT OR RUN on the dev machine (no Docker available there). See docs/DEPLOYMENT.md.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty = same-origin: the browser calls /api on whatever host serves the page (nginx proxies it).
# Caveat: src/lib/api.ts falls back to http://localhost:8000 only when VITE_API_BASE is undefined;
# an empty string is kept as-is, giving relative URLs.
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
