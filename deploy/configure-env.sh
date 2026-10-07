#!/bin/bash
# Configure environment variables for HOPE Project

set -e

echo "=========================================="
echo "🔐 Environment Configuration"
echo "=========================================="

# Generate JWT Secret
echo "Generating secure JWT secret..."
JWT_SECRET=$(openssl rand -base64 48)

# Collect Database credentials
echo ""
echo "📊 Supabase Database Configuration"
echo "   (Find these in your Supabase project settings)"
echo ""
read -p "Database Host (e.g., aws-0-ap-south-1.pooler.supabase.com): " DB_HOST
read -p "Database Name (usually 'postgres'): " DB_NAME
read -p "Database User: " DB_USER
read -sp "Database Password: " DB_PASSWORD
echo ""

# Backend Core .env
echo ""
echo "📝 Creating backend/core/.env..."
cat > backend/core/.env <<EOF
PORT=3005
DB_DIALECT=postgres
DB_HOST=${DB_HOST}
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# JWT Secret for authentication
JWT_SECRET=${JWT_SECRET}
EOF

echo "✅ Created backend/core/.env"

# Create .env for each microservice
echo ""
echo "📝 Creating .env files for microservices..."

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

for service in "${MICROSERVICES[@]}"; do
    if [ -f "backend/services/$service/.env.example" ]; then
        cp backend/services/$service/.env.example backend/services/$service/.env

        # Update DB credentials in each service .env
        sed -i "s|DB_HOST=.*|DB_HOST=${DB_HOST}|g" backend/services/$service/.env
        sed -i "s|DB_USER=.*|DB_USER=${DB_USER}|g" backend/services/$service/.env
        sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|g" backend/services/$service/.env
        sed -i "s|DB_NAME=.*|DB_NAME=${DB_NAME}|g" backend/services/$service/.env

        echo "  ✅ backend/services/$service/.env"
    fi
done

# Frontend environment
echo ""
read -p "What will be your backend URL? (e.g., https://api.yourdomain.com or http://YOUR_EC2_IP:3005): " BACKEND_URL

cat > frontend-react/.env.production <<EOF
VITE_API_URL=${BACKEND_URL}
EOF

echo "✅ Created frontend-react/.env.production"

echo ""
echo "=========================================="
echo "✅ Environment configuration complete!"
echo ""
echo "🔒 IMPORTANT SECURITY NOTES:"
echo "   - Your JWT_SECRET: ${JWT_SECRET}"
echo "   - Save this secret somewhere safe!"
echo "   - Never commit .env files to Git"
echo "=========================================="
