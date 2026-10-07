#!/bin/bash
# HOPE Project - EC2 Initial Setup Script
# Run this script on a fresh Ubuntu 22.04 EC2 instance (t3.medium)

set -e  # Exit on any error

echo "=========================================="
echo "🚀 HOPE Project - EC2 Setup Starting..."
echo "=========================================="

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x (LTS)
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node and npm
node --version
npm --version

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install Nginx (web server / reverse proxy)
echo "📦 Installing Nginx..."
sudo apt install -y nginx

# Install Certbot (for free SSL certificates)
echo "📦 Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Install PM2 globally (process manager)
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/hope-project
sudo chown -R ubuntu:ubuntu /var/www/hope-project

# Clone repository
echo "📥 Cloning HOPE Project repository..."
echo "⚠️  You'll need to provide your Git repository URL"
echo "    If private repo, set up SSH key first: ssh-keygen -t ed25519"
echo ""
read -p "Enter your Git repository URL: " REPO_URL

if [ ! -z "$REPO_URL" ]; then
    cd /var/www/hope-project
    git clone "$REPO_URL" . || echo "⚠️  Clone failed - you may need to set up Git credentials"
fi

echo ""
echo "✅ Base system setup complete!"
echo ""
echo "=========================================="
echo "Next Steps:"
echo "1. Configure environment variables (run ./deploy/configure-env.sh)"
echo "2. Install dependencies (run ./deploy/install-deps.sh)"
echo "3. Start services (run ./deploy/start-services.sh)"
echo "=========================================="
