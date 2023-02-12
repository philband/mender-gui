FROM --platform=amd64 node:19.5.0-alpine AS base
WORKDIR /usr/src/app
COPY package-lock.json package.json ./
RUN npm ci

FROM mendersoftware/gui:base AS disclaim
RUN npm run disclaim

FROM base AS build
COPY . ./
RUN npm run build

FROM nginx:1.23.3-alpine
EXPOSE 8080
RUN install -o 65534 -g 65534 -d /var/www/mender-gui/dist
WORKDIR /var/www/mender-gui/dist
ARG GIT_COMMIT_TAG
ENV GIT_COMMIT_TAG="${GIT_COMMIT_TAG:-local_local}"

COPY --chown=65534:65534 ./entrypoint.sh /entrypoint.sh
COPY --chown=65534:65534 httpd.conf /etc/nginx/nginx.conf
COPY --chown=65534:65534 --from=build /usr/src/app/dist .

ENTRYPOINT ["/entrypoint.sh"]
HEALTHCHECK --interval=8s --timeout=15s --start-period=120s --retries=128 CMD wget --quiet --tries=1 --spider --output-document=/dev/null 127.0.0.1
CMD ["nginx"]
