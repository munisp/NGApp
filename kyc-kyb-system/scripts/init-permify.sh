#!/bin/sh
set -e

echo "Initializing Permify schema..."

# Wait for Permify to be ready
echo "Waiting for Permify to be ready..."
until curl -sf http://permify:3476/healthz > /dev/null 2>&1; do
  echo "Waiting for Permify..."
  sleep 5
done
echo "Permify is ready!"

# Load schema
echo "Loading Permify schema..."
curl -X POST "http://permify:3476/v1/schemas/write" \
  -H "Content-Type: application/json" \
  -d @/permify/schema.perm

# Load relationships
echo "Loading Permify relationships..."
curl -X POST "http://permify:3476/v1/relationships/write" \
  -H "Content-Type: application/json" \
  -d @/permify/relationships.yaml

echo "Permify schema and relationships loaded successfully!"
