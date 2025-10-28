#!/bin/bash

echo "🚀 Setting up Curriculum Generator App..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required"
    exit 1
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Copy environment files if they don't exist
echo "📝 Setting up environment files..."
[ ! -f packages/frontend/.env.local ] && cp packages/frontend/.env.example packages/frontend/.env.local
[ ! -f packages/backend/.env ] && cp packages/backend/.env.example packages/backend/.env

# Set up Husky
echo "🪝 Setting up Git hooks..."
npm run prepare

# Check for MongoDB
echo "🔍 Checking for MongoDB..."
if command -v mongod &> /dev/null; then
    echo "✅ MongoDB is installed"
else
    echo "⚠️  MongoDB is not installed. Please install MongoDB:"
    echo "   macOS: brew install mongodb-community@6.0"
    echo "   Linux: See https://docs.mongodb.com/manual/installation/"
fi

# Check for Redis
echo "🔍 Checking for Redis..."
if command -v redis-server &> /dev/null; then
    echo "✅ Redis is installed"
else
    echo "⚠️  Redis is not installed. Please install Redis:"
    echo "   macOS: brew install redis"
    echo "   Linux: sudo apt-get install redis-server"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update environment variables in:"
echo "   - packages/frontend/.env.local"
echo "   - packages/backend/.env"
echo ""
echo "2. Make sure MongoDB and Redis are running:"
echo "   macOS:"
echo "     brew services start mongodb-community"
echo "     brew services start redis"
echo "   Linux:"
echo "     sudo systemctl start mongod"
echo "     sudo systemctl start redis"
echo ""
echo "3. Run database migrations:"
echo "   cd packages/backend && npm run migrate"
echo ""
echo "4. Start development servers:"
echo "   npm run dev"
echo ""
echo "5. Access services:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:4000"
