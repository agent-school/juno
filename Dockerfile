FROM node:24-bookworm-slim
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
RUN npm install -g pnpm@11.24.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/browser/package.json packages/browser/package.json
COPY packages/lab/package.json packages/lab/package.json
COPY packages/knowledge/package.json packages/knowledge/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @juno/browser exec playwright install --with-deps chromium
COPY packages/ packages/
RUN pnpm build && mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production
ENV PORT=5123
ENV JUNO_LAB_CHANNEL=chromium
ENV JUNO_LAB_DATA_DIR=/data
EXPOSE 5123
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:5123/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "lab"]
