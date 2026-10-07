# AWS Configuration
variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-south-1" # Mumbai - Change to your preferred region
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "production"
}

# EC2 Configuration
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
  # Options:
  # - t3.small  (~$15/mo) - For testing/light load
  # - t3.medium (~$30/mo) - Recommended for production
  # - t3.large  (~$60/mo) - For high traffic
}

variable "root_volume_size" {
  description = "Size of root EBS volume in GB"
  type        = number
  default     = 20
}

# SSH Key Configuration
variable "public_key_path" {
  description = "Path to SSH public key file"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
  # Generate with: ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
}

variable "ssh_allowed_ips" {
  description = "List of IP addresses allowed to SSH (use your IP for security)"
  type        = list(string)
  default     = ["0.0.0.0/0"] # WARNING: Open to all. Change to ["YOUR_IP/32"] for security
}

# GitHub Repository
variable "github_repo" {
  description = "GitHub repository URL for HOPE project"
  type        = string
  default     = "https://github.com/Santhosh-L-source/12_parameters.git"
}

# Database Configuration (Supabase)
variable "db_host" {
  description = "Supabase database host"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "postgres"
}

variable "db_user" {
  description = "Database user"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# JWT Secret
variable "jwt_secret" {
  description = "JWT secret for authentication (min 32 characters)"
  type        = string
  sensitive   = true
  # Generate with: openssl rand -base64 48
}

# Frontend Deployment Options
variable "deploy_frontend" {
  description = "Deploy frontend on EC2 along with backend"
  type        = bool
  default     = false # Set to false if using S3/CloudFront instead
}

variable "deploy_frontend_to_s3" {
  description = "Deploy frontend to S3 + CloudFront (recommended for production)"
  type        = bool
  default     = false
}

variable "s3_bucket_name" {
  description = "S3 bucket name for frontend (leave empty for auto-generated name)"
  type        = string
  default     = ""
}

# Tags
variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default = {
    Project    = "HOPE"
    ManagedBy  = "Terraform"
    Repository = "github.com/Santhosh-L-source/12_parameters"
  }
}
