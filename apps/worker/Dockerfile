# Build from the repo root: docker build -f apps/worker/Dockerfile .
# Playwright base image so the intra scraper can run headless Chromium later.
FROM mcr.microsoft.com/playwright:v1.56.1-noble AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --filter @studybuddy/worker...
COPY apps/worker apps/worker
COPY packages/db packages/db
RUN pnpm --filter @studybuddy/worker build \
  && pnpm deploy --filter @studybuddy/worker --prod --legacy /out

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER pwuser
EXPOSE 8080
CMD ["node", "dist/index.js"]
