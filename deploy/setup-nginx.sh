#!/bin/bash
# Setup Nginx for HOPE Project

set -e

echo "=========================================="
echo "🌐 Configuring Nginx"
echo "=========================================="

# Copy Nginx configuration
echo "📝 Installing Nginx configuration..."
sudo cp deploy/nginx-config.conf /etc/nginx/sites-available/hope-project

# Enable the site
echo "✅ Enabling site..."
sudo ln -sf /etc/nginx/sites-available/hope-project /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
echo ""
echo "🔍 Testing Nginx configuration..."
sudo nginx -t

# Reload Nginx
echo ""
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx

echo ""
echo "✅ Nginx configured successfully!"
echo ""
echo "🌐 Your backend is now accessible at:"
echo "   http://$(curl -s ifconfig.me):80"
echo "   or http://YOUR_EC2_PUBLIC_IP"
echo ""
echo "📋 Next Steps:"
echo "1. Update your EC2 Security Group to allow HTTP (port 80)"
echo "2. For HTTPS, run: sudo certbot --nginx -d your-domain.com"
echo "3. Update frontend .env.production with this URL"
