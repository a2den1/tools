FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
  && pip3 install --no-cache-dir --break-system-packages -U "yt-dlp[default]" \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js ./

ENV PORT=8787
EXPOSE 8787
CMD ["node", "index.js"]
