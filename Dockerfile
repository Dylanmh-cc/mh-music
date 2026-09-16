# MH Music accounts server — single self-contained Node file, zero dependencies.
# This image runs ONLY server/auth-server.mjs. The frontend is deployed
# separately (see DEPLOY.md). Using a Dockerfile makes Railway skip its
# Vite/static-site auto-detection and run exactly what we want.
FROM node:24-slim
WORKDIR /app
COPY server/auth-server.mjs ./auth-server.mjs
# The app reads PORT from the environment (Railway injects it); default 8787 locally.
CMD ["node", "auth-server.mjs"]
