FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /srv

COPY package.json server.js ./
COPY app ./app
COPY design ./design

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.js"]
