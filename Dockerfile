FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build -- --base=/

FROM nginx:stable-alpine
# MapLibre's ES module worker needs a JavaScript MIME type.
RUN sed -i 's|application/javascript[[:space:]]*js;|application/javascript js mjs;|' /etc/nginx/mime.types
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
