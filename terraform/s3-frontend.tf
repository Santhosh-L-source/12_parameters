# Optional: S3 + CloudFront for Frontend Deployment
# This file is only used if you set: deploy_frontend_to_s3 = true

# S3 Bucket for Frontend Static Files
resource "aws_s3_bucket" "frontend" {
  count  = var.deploy_frontend_to_s3 ? 1 : 0
  bucket = var.s3_bucket_name != "" ? var.s3_bucket_name : "hope-frontend-${random_id.bucket_suffix[0].hex}"

  tags = merge(var.tags, {
    Name = "HOPE Frontend Bucket"
    Type = "Frontend"
  })
}

# Random suffix for unique bucket name
resource "random_id" "bucket_suffix" {
  count       = var.deploy_frontend_to_s3 ? 1 : 0
  byte_length = 4
}

# Enable static website hosting
resource "aws_s3_bucket_website_configuration" "frontend" {
  count  = var.deploy_frontend_to_s3 ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html" # SPA routing - always serve index.html
  }
}

# Block public access settings (we'll use CloudFront)
resource "aws_s3_bucket_public_access_block" "frontend" {
  count  = var.deploy_frontend_to_s3 ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "frontend" {
  count   = var.deploy_frontend_to_s3 ? 1 : 0
  comment = "HOPE Frontend OAI"
}

# S3 Bucket Policy for CloudFront
resource "aws_s3_bucket_policy" "frontend" {
  count  = var.deploy_frontend_to_s3 ? 1 : 0
  bucket = aws_s3_bucket.frontend[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.frontend[0].iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend[0].arn}/*"
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  count   = var.deploy_frontend_to_s3 ? 1 : 0
  enabled = true
  comment = "HOPE Project Frontend Distribution"

  default_root_object = "index.html"

  origin {
    domain_name = aws_s3_bucket.frontend[0].bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.frontend[0].id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend[0].cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend[0].id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600   # 1 hour
    max_ttl                = 86400  # 24 hours
    compress               = true
  }

  # Custom error response for SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # For custom domain, use:
    # acm_certificate_arn = var.ssl_certificate_arn
    # ssl_support_method  = "sni-only"
  }

  tags = merge(var.tags, {
    Name = "HOPE Frontend CDN"
  })
}

# Outputs for S3 deployment
output "s3_bucket_name" {
  description = "S3 bucket name for frontend"
  value       = var.deploy_frontend_to_s3 ? aws_s3_bucket.frontend[0].id : null
}

output "s3_website_endpoint" {
  description = "S3 website endpoint"
  value       = var.deploy_frontend_to_s3 ? aws_s3_bucket_website_configuration.frontend[0].website_endpoint : null
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain"
  value       = var.deploy_frontend_to_s3 ? aws_cloudfront_distribution.frontend[0].domain_name : null
}

output "cloudfront_url" {
  description = "CloudFront URL for frontend"
  value       = var.deploy_frontend_to_s3 ? "https://${aws_cloudfront_distribution.frontend[0].domain_name}" : null
}
