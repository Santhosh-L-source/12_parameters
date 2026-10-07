#!/bin/bash
# Install dependencies for all services

set -e

echo "=========================================="
echo "📦 Installing Dependencies"
echo "=========================================="

# Backend Core
echo ""
echo "📦 Installing backend/core dependencies..."
cd backend/core
npm ci --omit=dev --loglevel=error
cd ../..

# All Microservices
MICROSERVICES=(
    "coding-platform"
    "cp-rating"
    "open-source"
    "competition"
    "internship-startup"
    "project-pub-patent"
    "foreign-language"
    "gate-exam"
    "monthly-coding"
    "100days"
    "aptitude-comm"
    "certificate-achievement"
)

echo ""
echo "📦 Installing microservice dependencies..."
for service in "${MICROSERVICES[@]}"; do
    if [ -f "backend/services/$service/package.json" ]; then
        echo "  → $service"
        cd backend/services/$service
        npm ci --omit=dev --loglevel=error 2>/dev/null || npm install --production --loglevel=error
        cd ../../..
    fi
done

echo ""
echo "✅ All dependencies installed!"
echo ""
echo "Total installation size:"
du -sh backend/core/node_modules backend/services/*/node_modules 2>/dev/null | awk '{sum+=$1} END {print sum " in node_modules"}'
