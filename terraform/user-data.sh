#!/bin/bash
# HOPE Project - EC2 Bootstrap Script (User Data)
# This script runs automatically when the EC2 instance is created

set -e

# Log all output
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=========================================="
echo "🚀 HOPE Project - Bootstrap Starting..."
echo "=========================================="
echo "Timestamp: $(date)"

# Update system
echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

# Install Node.js 20.x LTS
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install required packages
echo "📦 Installing Git, Nginx, and other dependencies..."
apt-get install -y git nginx certbot python3-certbot-nginx

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Create application directory
echo "📁 Setting up application directory..."
mkdir -p /var/www/hope-project
cd /var/www/hope-project

# Clone repository
echo "📥 Cloning HOPE Project repository..."
git clone ${github_repo} .

# Make deployment scripts executable
chmod +x deploy/*.sh

# Create .env files
echo "🔐 Configuring environment variables..."

# Backend core .env
cat > backend/core/.env <<EOF
PORT=3005
DB_DIALECT=postgres
DB_HOST=${db_host}
DB_PORT=5432
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=${db_password}
JWT_SECRET=${jwt_secret}
EOF

# Create .env for each microservice
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

for service in "$${MICROSERVICES[@]}"; do
    if [ -f "backend/services/$service/.env.example" ]; then
        cp backend/services/$service/.env.example backend/services/$service/.env

        # Update DB credentials
        sed -i "s|DB_HOST=.*|DB_HOST=${db_host}|g" backend/services/$service/.env
        sed -i "s|DB_USER=.*|DB_USER=${db_user}|g" backend/services/$service/.env
        sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${db_password}|g" backend/services/$service/.env
        sed -i "s|DB_NAME=.*|DB_NAME=${db_name}|g" backend/services/$service/.env

        echo "  ✅ Configured backend/services/$service/.env"
    fi
done

# Get instance public IP
INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Frontend environment
cat > frontend-react/.env.production <<EOF
VITE_API_URL=http://$INSTANCE_IP
EOF

echo "✅ Environment configured with IP: $INSTANCE_IP"

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend/core
npm ci --omit=dev --loglevel=error
cd ../..

echo "📦 Installing microservice dependencies..."
for service in "$${MICROSERVICES[@]}"; do
    if [ -f "backend/services/$service/package.json" ]; then
        echo "  → $service"
        cd backend/services/$service
        npm ci --omit=dev --loglevel=error 2>/dev/null || npm install --production --loglevel=error
        cd ../../..
    fi
done

# Create logs directory
mkdir -p logs

# Setup PM2 ecosystem
echo "🚀 Setting up PM2 services..."
pm2 start deploy/pm2-ecosystem.config.js
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Setup Nginx
echo "🌐 Configuring Nginx..."
cp deploy/nginx-config.conf /etc/nginx/sites-available/hope-project
ln -sf /etc/nginx/sites-available/hope-project /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx

%{ if frontend_enabled }
# Build and serve frontend
echo "🎨 Building and deploying frontend..."
cd frontend-react
npm install
npm run build
cd ..

# Install serve globally
npm install -g serve

# Create systemd service for frontend
cat > /etc/systemd/system/hope-frontend.service <<FRONTEND
[Unit]
Description=HOPE Project Frontend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/hope-project
ExecStart=/usr/bin/serve -s frontend-react/dist -l 3000
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
FRONTEND

systemctl daemon-reload
systemctl enable hope-frontend
systemctl start hope-frontend

echo "✅ Frontend deployed on port 3000"
%{ endif }

# Set proper ownership
chown -R ubuntu:ubuntu /var/www/hope-project

# Setup firewall
echo "🔒 Configuring firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Frontend
ufw allow 3005/tcp  # Backend API

# Final health check
echo ""
echo "🔍 Running health check..."
sleep 10
HEALTH_STATUS=$(curl -s http://localhost:3005/health || echo "Health check failed")
echo "Health check response: $HEALTH_STATUS"

echo ""
echo "=========================================="
echo "✅ Bootstrap Complete!"
echo "=========================================="
echo "Timestamp: $(date)"
echo ""
echo "Backend API: http://$INSTANCE_IP"
echo "Frontend:    http://$INSTANCE_IP:3000"
echo "Health:      http://$INSTANCE_IP/health"
echo ""
echo "View logs: tail -f /var/log/user-data.log"
echo "PM2 status: pm2 status"
echo "=========================================="

# Create a completion marker
echo "BOOTSTRAP_COMPLETE" > /var/www/hope-project/.bootstrap-complete
