FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN yarn install --non-interactive --ignore-engines --network-timeout 600000

COPY . .
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    NODE_ENV=production \
    CI=false \
    DISABLE_ESLINT_PLUGIN=true \
    TSC_COMPILE_ON_ERROR=true \
    GENERATE_SOURCEMAP=false

RUN yarn build

FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
