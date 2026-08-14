# syntax=docker/dockerfile:1.7

ARG ECOKU_VERSION=development
ARG ECOKU_REVISION=unknown
ARG ECOKU_SOURCE=""

FROM node:24.18.0-alpine3.24 AS frontend-build
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/admin/package.json packages/admin/package.json
COPY packages/client/package.json packages/client/package.json
RUN --mount=type=cache,id=ecoku-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY packages/admin packages/admin
COPY packages/client packages/client
RUN pnpm --dir packages/client build \
    && pnpm --dir packages/admin build

FROM golang:1.26.5-alpine3.24 AS server-build
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN --mount=type=cache,id=ecoku-go-mod,target=/go/pkg/mod \
    go mod download
COPY server ./
RUN --mount=type=cache,id=ecoku-go-mod,target=/go/pkg/mod \
    --mount=type=cache,id=ecoku-go-build,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ecoku-server .

FROM alpine:3.24.1 AS runtime
ARG ECOKU_VERSION
ARG ECOKU_REVISION
ARG ECOKU_SOURCE
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
COPY --from=frontend-build --chown=ecoku:ecoku /src/packages/admin/dist /app/admin
COPY --from=frontend-build --chown=ecoku:ecoku /src/packages/client/dist/ecoku.umd.js /app/client/ecoku.umd.js
COPY --from=frontend-build --chown=ecoku:ecoku /src/packages/client/dist/ecoku-loader.js /app/client/ecoku-loader.js
USER 10001:10001
EXPOSE 12123
STOPSIGNAL SIGTERM
ENTRYPOINT ["/app/ecoku-server"]
