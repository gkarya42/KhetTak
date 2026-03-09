# KhetTak (data gathering v1)

This repo contains:

- `backend/`: **Python FastAPI** API connected to **Postgres**
- `admin/`: **React** admin console to customize questions
- `mobile/`: **React Native (Expo)** Android app for capturing customer data

## Why this design (reasoning)

- **Dynamic questions**: Questions live in Postgres (`questions` table). The Android app fetches the latest schema at runtime, so changes in the admin console reflect immediately without shipping a new APK.
- **Analytics-friendly storage**: Submissions are stored in Postgres as `JSONB` (`submissions.answers`) so you can add/modify questions over time without migrations. Postgres can still query JSONB efficiently later.
- **Best-fit frameworks**:
  - **React Native (Expo)** for fastest Android delivery with a modern React stack.
  - **React (Vite)** for a simple admin web UI.
  - **FastAPI** for a clean Python API with validation and OpenAPI docs.

## Data captured (initial questions)

Seeded on first backend startup:

1. **Customer name** (mandatory)
2. **Customer contact number** (mandatory)
3. **Customer village/address** (mandatory)
4. **Product needs to buy** (repeatable list: product name + quantity)
5. **Are we able to fulfill the order or not** (yes/no)

## Local setup (steps)

## Prerequisites

- **Docker Desktop**: must be running (for Postgres)
- **Node.js 20+** (recommended via `nvm`) for `admin/` and `mobile/`
- **Python 3.11+** for `backend/`

### 1) Start Postgres

```bash
docker compose up -d
```

### 2) Run the backend API (+ serve admin UI from same server)

With Docker (recommended):

```bash
docker compose up -d --build
```

Open:
- Admin UI: `http://localhost:8000/`
- API docs: `http://localhost:8000/docs`

Or run locally (dev):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

API docs:
- `http://localhost:8000/docs`

Default login (change in `backend/.env` or `docker-compose.yml`):
- **username**: `admin`
- **password**: `admin123`

### 3) Run the admin console

```bash
cd admin
cp .env.example .env
npm install
npm run dev
```

Admin UI:
- `http://localhost:5173`

### 4) Run the Android data capture app

```bash
cd mobile
cp .env.example .env
npm install
npm run start
```

Then press `a` to open Android (emulator/device).

## Environment

- Backend reads `DATABASE_URL` from `backend/.env`
- Admin + Mobile read `VITE_API_BASE_URL` / `EXPO_PUBLIC_API_BASE_URL`

