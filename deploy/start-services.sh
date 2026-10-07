#!/bin/bash
# Start all HOPE Project services with PM2

set -e

echo "=========================================="
echo "🚀 Starting HOPE Project Services"
echo "=========================================="

# Create logs directory
mkdir -p logs

# Stop any existing PM2 processes
echo "🛑 Stopping existing services..."
pm2 delete all 2>/dev/null || true

# Start all services using ecosystem config
echo ""
echo "🚀 Starting all services..."
pm2 start deploy/pm2-ecosystem.config.js

# Save PM2 process list
echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on system boot
echo ""
echo "⚡ Configuring PM2 startup..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo ""
echo "=========================================="
echo "✅ All services started successfully!"
echo "=========================================="
echo ""
echo "📊 Service Status:"
pm2 status

echo ""
echo "📝 Useful PM2 Commands:"
echo "   pm2 status          - View all services"
echo "   pm2 logs            - View all logs"
echo "   pm2 logs hope-gateway - View specific service logs"
echo "   pm2 restart all     - Restart all services"
echo "   pm2 stop all        - Stop all services"
echo "   pm2 monit           - Real-time monitoring"
echo ""
echo "🌐 API Gateway running on: http://localhost:3005"
echo "   Health check: curl http://localhost:3005/health"
