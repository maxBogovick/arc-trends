#!/bin/bash
set -e

echo "🚀 Starting Zdesagochi Local Development Environment..."

# 1. Clean up properly on exit (kills entire process group)
cleanup() {
    echo ""
    echo "🛑 Shutting down (killing all child processes)..."
    # Kill the current process group, effectively stopping npm, vite, cargo, and rust backend
    trap - EXIT SIGINT SIGTERM
    kill -- -$$ 2>/dev/null || true
}
trap cleanup EXIT SIGINT SIGTERM

# 2. Setup backend environment and databases
echo "⚙️  Setting up Backend..."
cd backend

if [ ! -f .env ]; then
    echo "⚠️  .env file not found in backend/. Creating one from .env.example..."
    cp .env.example .env
fi

# 3. Start databases and wait for them to be healthy
echo "🐳 Starting PostgreSQL and Redis (and waiting for them to be ready)..."
docker compose up -d --wait postgres redis

cd ..

echo "✅ Databases are ready. Starting servers..."
echo "================================================="

# 4. Start backend and frontend concurrently
# We run them in the background and wait.
# stdout/stderr are prefixed if possible, but basic bg execution works fine with process group kill.

(
    cd backend
    echo "📦 [BACKEND] Starting (cargo run)..."
    cargo run
) &

(
    echo "🌐 [FRONTEND] Starting (npm run dev)..."
    npm run dev
) &

# Wait for all background jobs
wait
