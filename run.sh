#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# copy .env template if not present
[ -f .env ] || cp .env.example .env

# create venv if needed
if [ ! -d venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

# Generate city data on first run (downloads ~2 MB from GeoNames, takes ~10 s)
if [ ! -f data/cities.json ]; then
  echo "  Generating city database (one-time, ~10 seconds)..."
  python generate_cities.py
fi

# Kill any previous instance on port 5050
while true; do
  PIDS=$(lsof -ti :5050 2>/dev/null || true)
  [ -z "$PIDS" ] && break
  echo "  Stopping previous instance(s): $PIDS"
  echo "$PIDS" | xargs kill 2>/dev/null || true
  sleep 1
done

echo ""
echo "  Starting Business Finder..."
echo "  Open: http://localhost:5050"
echo ""
python app.py
