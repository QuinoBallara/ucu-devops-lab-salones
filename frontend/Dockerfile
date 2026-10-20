# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
ENV BACKEND_URL=http://backend:3000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
