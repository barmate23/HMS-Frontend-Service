# Stage 1: Build the Angular application
FROM node:18-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve the application with Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/hms-modern-app /usr/share/nginx/html
# Angular 17+ uses dist/project-name/browser output. If it fails, we will remove /browser.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
