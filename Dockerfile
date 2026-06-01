# ── Stage 1: build React frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ── Stage 2: run FastAPI backend ──────────────────────────────────────────────
FROM python:3.11-slim

# Install Python deps first (layer cached unless requirements change)
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source into /app/backend
COPY backend/ ./backend/

# Copy built frontend into /app/frontend/dist
# main.py resolves this path relative to its own __file__, so structure matters.
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create /data directory for SQLite persistence
RUN mkdir -p /data

# Tell the app where to find the DB.
# On Railway: attach a Volume mounted at /data so it survives redeploys.
ENV DATABASE_URL=sqlite:////data/face_gifts.db

# Run uvicorn from /app/backend so `from app.xxx import` works
WORKDIR /app/backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
