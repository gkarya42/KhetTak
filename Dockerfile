#
# Single-container deploy: FastAPI serves API + admin web build
#

FROM node:20-alpine AS web_build
WORKDIR /web
COPY admin/package.json admin/package-lock.json* /web/
RUN npm install
COPY admin /web
RUN npm run build

FROM python:3.11-slim AS api

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/app /app/app
COPY --from=web_build /web/dist /app/app/web

EXPOSE 8000
# Render sets $PORT; locally this falls back to 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

