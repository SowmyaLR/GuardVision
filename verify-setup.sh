#!/bin/bash
# GuardVision Setup Verification Script for Linux/macOS

echo "============================================================"
echo "GuardVision Setup Validation"
echo "============================================================"
echo ""

# Check if .env file exists
echo "Checking if .env file exists..."
if [ -f .env ]; then
    echo "✅ .env file found"
else
    echo "❌ .env file not found"
    echo "Please run: cp .env.example .env"
    echo "Then add your GEMINI_API_KEY to the .env file"
    exit 1
fi
echo ""

# Check if Docker is running
echo "Checking if Docker is running..."
if docker ps > /dev/null 2>&1; then
    echo "✅ Docker is running"
else
    echo "❌ Docker is not running"
    echo "Please start Docker and try again"
    exit 1
fi
echo ""

echo "Checking services (this may take a moment)..."
sleep 3

# Check Backend API
echo -n "Checking Backend API... "
if curl -f -s http://localhost:9000/health > /dev/null 2>&1; then
    echo "✅ OK"
    BACKEND_OK=1
else
    echo "⚠️  Not responding yet"
    echo "This is normal if services just started. Wait 30-60s and try again."
    BACKEND_OK=0
fi

# Check Frontend
echo -n "Checking Frontend... "
if curl -f -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ OK"
    FRONTEND_OK=1
else
    echo "⚠️  Not responding yet"
    echo "This is normal if services just started. Wait 30-60s and try again."
    FRONTEND_OK=0
fi

echo ""
echo "============================================================"

if [ $BACKEND_OK -eq 1 ] && [ $FRONTEND_OK -eq 1 ]; then
    echo "✅ All services are running correctly!"
    echo ""
    echo "Next steps:"
    echo "  • Frontend:  http://localhost:3000"
    echo "  • Backend:   http://localhost:9000"
    echo "  • API Docs:  http://localhost:9000/docs"
    echo ""
    echo "You're ready to start developing! 🚀"
else
    echo "⚠️  Some services are not ready yet"
    echo ""
    echo "Troubleshooting:"
    echo "  • View running services: docker compose ps"
    echo "  • View logs:             docker compose logs"
    echo "  • Restart services:      docker compose restart"
    echo "  • See README.md for more troubleshooting tips"
fi

echo "============================================================"
