# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

ARG ECOKU_VERSION=development
ARG ECOKU_REVISION=unknown
ARG ECOKU_SOURCE=""

FROM node:24.19.0-alpine3.24@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS frontend-deps
WORKDIR /src
RUN npm install --global pnpm@11.24.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/admin/package.json packages/admin/package.json
COPY packages/client/package.json packages/client/package.json
RUN --mount=type=cache,id=ecoku-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --store-dir=/root/.local/share/pnpm/store
FROM frontend-deps AS client-build
COPY packages/client packages/client
RUN pnpm --dir packages/client build

FROM frontend-deps AS admin-build
COPY packages/admin packages/admin
RUN pnpm --dir packages/admin build

FROM golang:1.27.0-alpine3.24@sha256:4c9fe60190a2a3350ddc51de80d0224b8a6698d12bdfc999fee45ea9d6c46dbc AS server-build
WORKDIR /src
COPY server/go.mod server/go.sum ./
# Module contents travel with the dependency layer in the exported registry cache.
# An empty cache mount on a new runner must not hide a restored dependency layer.
RUN go mod download
COPY server ./
RUN --mount=type=cache,id=ecoku-go-build,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ecoku-server .

FROM alpine:3.24.1@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS runtime
ARG ECOKU_VERSION
ARG ECOKU_REVISION
ARG ECOKU_SOURCE
# ECOKU_RUNTIME selects the fixed image paths.
ENV GIN_MODE=release \
    ECOKU_RUNTIME=container
LABEL org.opencontainers.image.title="Ecoku" \
      org.opencontainers.image.description="Self-hosted plain-text comment system" \
      org.opencontainers.image.version="${ECOKU_VERSION}" \
      org.opencontainers.image.revision="${ECOKU_REVISION}" \
      org.opencontainers.image.source="${ECOKU_SOURCE}" \
      org.opencontainers.image.licenses="MIT"
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 10001 ecoku \
    && adduser -S -D -H -u 10001 -G ecoku ecoku \
    && install -d -o ecoku -g ecoku -m 0750 /app /app/admin /app/client /data
WORKDIR /app
COPY --from=server-build --chown=ecoku:ecoku /out/ecoku-server /app/ecoku-server
COPY --from=admin-build --chown=ecoku:ecoku /src/packages/admin/dist /app/admin
COPY --from=client-build --chown=ecoku:ecoku /src/packages/client/dist/ecoku.umd.js /app/client/ecoku.umd.js
COPY --from=client-build --chown=ecoku:ecoku /src/packages/client/dist/ecoku-loader.js /app/client/ecoku-loader.js
COPY --from=client-build --chown=ecoku:ecoku /src/packages/client/dist/ecoku.css /app/client/ecoku.css
COPY --from=client-build --chown=ecoku:ecoku /src/packages/client/dist/ecoku.unstyled.css /app/client/ecoku.unstyled.css
USER 10001:10001
EXPOSE 12123
STOPSIGNAL SIGTERM
ENTRYPOINT ["/app/ecoku-server"]
