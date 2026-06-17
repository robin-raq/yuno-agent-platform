# Yuno Agents — container image for Railway.
# Includes the Goose CLI because the platform spawns `goose run` as a subprocess.
FROM node:20-bookworm-slim

# curl/bzip2 for the Goose installer; python3/build-essential as a better-sqlite3 build fallback.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates bzip2 python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

# Install the Goose CLI headlessly (no interactive configure). Provider/model/key come from env.
RUN curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | CONFIGURE=false bash
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# Install deps first (better layer caching).
COPY package*.json ./
RUN npm ci
COPY web/package*.json ./web/
RUN npm --prefix web ci

# App source + web build.
COPY . .
RUN npm --prefix web run build

ENV NODE_ENV=production
# Railway injects PORT; the app binds 0.0.0.0:$PORT (MCP stays on loopback). Templates seed on boot.
CMD ["npm", "start"]
