#!/bin/bash
# Deploy HOPE Frontend to S3 + CloudFront

set -e

echo "=========================================="
echo "🚀 Deploying Frontend to S3 + CloudFront"
echo "=========================================="

# Check if required tools are installed
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Install: https://aws.amazon.com/cli/"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }

# Get backend URL
read -p "Enter your backend URL (e.g., http://13.232.xxx.xxx): " BACKEND_URL

# Get S3 bucket name (from Terraform output or manual)
read -p "Enter S3 bucket name (from terraform output s3_bucket_name): " BUCKET_NAME

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Bucket name is required!"
  exit 1
fi

# Navigate to frontend directory
cd "$(dirname "$0")/../frontend-react"

# Update environment
echo "🔧 Configuring environment..."
cat > .env.production <<EOF
VITE_API_URL=${BACKEND_URL}
EOF

echo "✅ Backend URL set to: $BACKEND_URL"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Build frontend
echo ""
echo "🔨 Building frontend for production..."
npm run build

# Upload to S3
echo ""
echo "📤 Uploading to S3..."
aws s3 sync dist/ s3://${BUCKET_NAME} --delete

echo ""
echo "🔄 Creating CloudFront invalidation (to clear cache)..."
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='${BUCKET_NAME}.s3.amazonaws.com']].Id" --output text)

if [ ! -z "$DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
  echo "✅ Cache invalidated for distribution: $DISTRIBUTION_ID"
else
  echo "⚠️  CloudFront distribution not found (may not exist yet)"
fi

echo ""
echo "=========================================="
echo "✅ Frontend Deployment Complete!"
echo "=========================================="
echo ""
echo "Your frontend is now live at:"
echo "CloudFront URL: https://YOUR_CLOUDFRONT_DOMAIN (check terraform output)"
echo "S3 Website URL: http://${BUCKET_NAME}.s3-website-$(aws configure get region).amazonaws.com"
echo ""
echo "Next steps:"
echo "1. Get CloudFront URL: cd terraform && terraform output cloudfront_url"
echo "2. Test the frontend in your browser"
echo "3. (Optional) Setup custom domain with Route53"
echo "=========================================="
