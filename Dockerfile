# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

ARG ECOKU_VERSION=development
ARG ECOKU_REVISION=unknown
ARG ECOKU_SOURCE=""

FROM --platform=$BUILDPLATFORM node:26.13.1-alpine3.24@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS frontend-deps
WORKDIR /src
RUN npm install --global pnpm@11.28.9
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

FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine3.24@sha256:0a5f7fe796599ff487605987432e7619ae45beeb2fba4c2ce0b907879932aebf AS server-build
ARG TARGETOS
ARG TARGETARCH
ARG ECOKU_VERSION
WORKDIR /src
COPY server/go.mod server/go.sum ./
# Module contents travel with the dependency layer in the exported registry cache.
# An empty cache mount on a new runner must not hide a restored dependency layer.
RUN go mod download
COPY server ./
RUN --mount=type=cache,id=ecoku-go-build,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w -X ecoku-server/buildinfo.version=${ECOKU_VERSION}" -o /out/ecoku-server .
RUN mkdir -p /out/data && chown 10001:10001 /out/data && chmod 0750 /out/data

FROM gcr.io/distroless/static-debian13:nonroot@sha256:aafe993665bf6200db38a02c11a9351e782a84b6a45e7f33b6695638c88e3931 AS runtime
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
WORKDIR /app
COPY --from=server-build --chown=10001:10001 /out/data /data
COPY --from=server-build --chown=0:0 --chmod=0755 /out/ecoku-server /app/ecoku-server
COPY --from=admin-build --chown=0:0 /src/packages/admin/dist /app/admin
COPY --from=client-build --chown=0:0 /src/packages/client/dist/ecoku.umd.js /app/client/ecoku.umd.js
COPY --from=client-build --chown=0:0 /src/packages/client/dist/ecoku-loader.js /app/client/ecoku-loader.js
COPY --from=client-build --chown=0:0 /src/packages/client/dist/ecoku.css /app/client/ecoku.css
COPY --from=client-build --chown=0:0 /src/packages/client/dist/ecoku.unstyled.css /app/client/ecoku.unstyled.css
USER 10001:10001
EXPOSE 12123
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/app/ecoku-server", "healthcheck"]
ENTRYPOINT ["/app/ecoku-server"]
