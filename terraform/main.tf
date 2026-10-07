terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data source to get the latest Ubuntu 22.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (Ubuntu)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Create a VPC (or use default VPC)
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security Group for HOPE Project
resource "aws_security_group" "hope_sg" {
  name        = "hope-project-sg"
  description = "Security group for HOPE Project EC2 instance"
  vpc_id      = data.aws_vpc.default.id

  # SSH access
  ingress {
    description = "SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_ips
  }

  # HTTP access
  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Frontend port (temporary, for testing)
  ingress {
    description = "Frontend on port 3000"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Backend API Gateway (direct access for debugging)
  ingress {
    description = "Backend API Gateway"
    from_port   = 3005
    to_port     = 3005
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "hope-project-sg"
    Project     = "HOPE"
    Environment = var.environment
  }
}

# Create SSH key pair
resource "aws_key_pair" "hope_key" {
  key_name   = "hope-project-key"
  public_key = file(var.public_key_path)

  tags = {
    Name    = "hope-project-key"
    Project = "HOPE"
  }
}

# Elastic IP for static public IP
resource "aws_eip" "hope_eip" {
  domain   = "vpc"
  instance = aws_instance.hope_backend.id

  tags = {
    Name    = "hope-project-eip"
    Project = "HOPE"
  }
}

# EC2 Instance for HOPE Backend
resource "aws_instance" "hope_backend" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = aws_key_pair.hope_key.key_name

  vpc_security_group_ids = [aws_security_group.hope_sg.id]
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name    = "hope-project-root-volume"
      Project = "HOPE"
    }
  }

  user_data = templatefile("${path.module}/user-data.sh", {
    github_repo      = var.github_repo
    db_host          = var.db_host
    db_name          = var.db_name
    db_user          = var.db_user
    db_password      = var.db_password
    jwt_secret       = var.jwt_secret
    frontend_enabled = var.deploy_frontend
  })

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name        = "hope-project-backend"
    Project     = "HOPE"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch alarm for high CPU
resource "aws_cloudwatch_metric_alarm" "cpu_alarm" {
  alarm_name          = "hope-backend-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = []

  dimensions = {
    InstanceId = aws_instance.hope_backend.id
  }

  tags = {
    Project = "HOPE"
  }
}
