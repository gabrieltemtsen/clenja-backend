#!/bin/bash

# Clenja Backend Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environments: staging, production (default: production)

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Clenja Backend Deployment"
echo "=============================="
echo "Environment: $ENVIRONMENT"
echo "Project Root: $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

# Step 1: Check Node.js version
echo "📦 Checking Node.js version..."
node_version=$(node -v)
echo "   Node.js version: $node_version"

# Step 2: Install dependencies (production only)
echo ""
echo "📥 Installing dependencies..."
if [ "$ENVIRONMENT" = "production" ]; then
    npm ci --production=false
else
    npm ci
fi

# Step 3: Run linting
echo ""
echo "🔍 Running linter..."
npm run lint || {
    echo "⚠️  Linting warnings detected, continuing..."
}

# Step 4: Run tests
echo ""
echo "🧪 Running tests..."
npm run test -- --passWithNoTests || {
    echo "❌ Tests failed!"
    exit 1
}

# Step 5: Build the application
echo ""
echo "🏗️  Building application..."
npm run build

# Step 6: Verify build output
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found!"
    exit 1
fi

echo ""
echo "✅ Build completed successfully!"
echo ""

# Step 7: Production optimizations
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔧 Running production optimizations..."
    
    # Remove dev dependencies for smaller deployment
    npm prune --production
    
    echo "   Production dependencies only installed."
fi

# Step 8: Print next steps
echo ""
echo "=============================="
echo "📋 Deployment Ready!"
echo "=============================="
echo ""
echo "Next steps:"
echo "  1. Set environment variables (DATABASE_URL, JWT_SECRET, PAYSTACK_SECRET_KEY, etc.)"
echo "  2. Run database migrations (if using TypeORM migrations)"
echo "  3. Start the server: npm run start:prod"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔒 Production Reminders:"
    echo "  - Disable TypeORM synchronize option"
    echo "  - Use proper secrets management"
    echo "  - Configure proper logging"
    echo "  - Set up health checks and monitoring"
    echo ""
fi

echo "To start the application:"
echo "  NODE_ENV=$ENVIRONMENT npm run start:prod"
echo ""
echo "Done! 🎉"
