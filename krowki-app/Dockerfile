# Konfigurator + backend + panel grafika w jednym obrazie.
# Budowanie: docker build -t krowki-app krowki-app/
FROM node:22-bookworm-slim AS designer
WORKDIR /build
COPY designer/package.json designer/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY designer/ ./
RUN npm run build

FROM node:22-bookworm-slim
# Ghostscript do konwersji CMYK, colord-data zawiera profil FOGRA39L_coated.icc
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript colord-data \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=designer /build/dist /app/designer/dist
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data DESIGNER_DIST=/app/designer/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
