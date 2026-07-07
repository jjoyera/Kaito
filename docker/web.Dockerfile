FROM node:24.18-bookworm-slim

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@11.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
RUN chown -R node:node /workspace/apps/web

USER node

EXPOSE 3000
CMD ["pnpm", "--dir", "apps/web", "dev", "--hostname", "0.0.0.0"]
