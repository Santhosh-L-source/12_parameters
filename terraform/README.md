# 🚀 HOPE Project - Terraform Deployment

Deploy the entire HOPE Project to AWS with **one command** using Infrastructure as Code.

---

## 📋 Prerequisites

### 1. Install Terraform
```bash
# Windows (using Chocolatey)
choco install terraform

# macOS (using Homebrew)
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

Verify: `terraform --version`

### 2. AWS CLI Configured
```bash
# Install AWS CLI
# Windows: https://awscli.amazonaws.com/AWSCLIV2.msi
# macOS: brew install awscli
# Linux: sudo apt install awscli

# Configure credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region
```

### 3. SSH Key Pair
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# This creates:
# - Private key: ~/.ssh/id_rsa
# - Public key:  ~/.ssh/id_rsa.pub
```

### 4. Supabase Credentials Ready
- Database Host
- Database User
- Database Password

---

## 🚀 Quick Start (3 Commands)

### Step 1: Configure Variables
```bash
cd terraform

# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
# Windows: notepad terraform.tfvars
# macOS/Linux: nano terraform.tfvars
```

**Required changes in `terraform.tfvars`:**
```hcl
# Supabase Database
db_host     = "aws-0-ap-south-1.pooler.supabase.com"  # Your Supabase host
db_user     = "your_actual_user"                      # Your Supabase user
db_password = "your_actual_password"                  # Your Supabase password

# JWT Secret (generate with: openssl rand -base64 48)
jwt_secret = "paste_generated_secret_here"

# Security (optional but recommended)
ssh_allowed_ips = ["YOUR_IP/32"]  # Replace YOUR_IP with your actual IP
```

**Generate JWT Secret:**
```bash
# Run this to generate a secure JWT secret:
openssl rand -base64 48

# Copy the output and paste it into terraform.tfvars
```

---

### Step 2: Initialize Terraform
```bash
terraform init
```

This downloads the AWS provider plugin (~100MB).

---

### Step 3: Deploy!
```bash
# Preview what will be created
terraform plan

# Deploy to AWS
terraform apply

# Type 'yes' when prompted
```

**⏱️ Deployment Time: ~10-15 minutes**

- Terraform creates resources: ~1 minute
- EC2 bootstrap (installing dependencies, starting services): ~10 minutes

---

## 📊 What Gets Created

Terraform will create:

✅ **EC2 Instance** (t3.medium, Ubuntu 22.04)  
✅ **Elastic IP** (static public IP)  
✅ **Security Group** (ports 22, 80, 443, 3000, 3005)  
✅ **SSH Key Pair** (using your public key)  
✅ **CloudWatch Alarm** (CPU monitoring)

Total Resources: **5-6 AWS resources**

**Cost:** ~$30/month (see Cost Breakdown below)

---

## 📤 Outputs

After `terraform apply` completes, you'll see:

```
Outputs:

backend_api_url = "http://13.232.XXX.XXX"
backend_health_check = "http://13.232.XXX.XXX/health"
frontend_url = "http://13.232.XXX.XXX:3000"
instance_id = "i-0abc123def456"
instance_public_ip = "13.232.XXX.XXX"
ssh_connection_command = "ssh -i ~/.ssh/id_rsa ubuntu@13.232.XXX.XXX"

deployment_summary = <<EOT

========================================
🎉 HOPE Project Deployment Complete!
========================================

Backend API:     http://13.232.XXX.XXX
Health Check:    http://13.232.XXX.XXX/health
Frontend:        http://13.232.XXX.XXX:3000

...
EOT
```

---

## ✅ Post-Deployment

### 1. Wait for Bootstrap to Complete (~10 mins)

The EC2 instance needs time to:
- Install Node.js, PM2, Nginx
- Clone repository
- Install npm dependencies (large download)
- Start all 13 services

**Monitor progress:**
```bash
# SSH into the instance
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

# Watch the bootstrap log
tail -f /var/log/user-data.log

# When you see "BOOTSTRAP_COMPLETE", it's ready!
```

---

### 2. Test Backend
```bash
# From your local machine
curl http://YOUR_EC2_IP/health

# Expected: {"status":"ok","database":"connected"}
```

---

### 3. Test Frontend
Open in browser:
```
http://YOUR_EC2_IP:3000
```

Login:
- **Student**: `24CS360` / `312324104001`
- **Admin**: `admin` / `admin123`

---

## 🛠️ Terraform Commands

### View Current State
```bash
terraform show
```

### View Outputs Again
```bash
terraform output
terraform output instance_public_ip  # Specific output
```

### Update Infrastructure
```bash
# After changing variables or config
terraform apply
```

### Destroy Everything
```bash
# WARNING: This deletes ALL resources (EC2, IP, etc.)
terraform destroy

# Type 'yes' to confirm
```

---

## 🔧 Customization

### Change Instance Type
In `terraform.tfvars`:
```hcl
instance_type = "t3.small"  # For testing (~$15/mo)
# OR
instance_type = "t3.large"  # For high traffic (~$60/mo)
```

Then: `terraform apply`

---

### Change AWS Region
In `terraform.tfvars`:
```hcl
aws_region = "us-east-1"  # N. Virginia (cheapest)
# OR
aws_region = "ap-south-1" # Mumbai (closer to India)
```

**Note:** AMI is auto-selected for your region (no manual AMI ID needed!)

---

### Restrict SSH Access
In `terraform.tfvars`:
```hcl
# Find your IP: curl ifconfig.me
ssh_allowed_ips = ["203.0.113.42/32"]  # Replace with YOUR IP
```

---

## 💰 Cost Breakdown

**Monthly Costs (ap-south-1 Mumbai):**

| Resource | Type | Cost/Month |
|----------|------|------------|
| EC2 Instance | t3.medium | $30.37 |
| Elastic IP | Attached | $0.00 |
| EBS Volume | 20 GB gp3 | $1.60 |
| Data Transfer | ~50 GB out | $4.50 |
| **Total** | | **~$36/mo** |

**Cost Optimization:**
- Use `t3.small` → Save $15/mo (good for <50 users)
- Reserved Instance (1-year) → Save 30%
- Spot Instance → Save 70% (but can be interrupted)

---

## 🐛 Troubleshooting

### Bootstrap Not Completing?
```bash
# SSH into instance
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

# Check bootstrap log
tail -f /var/log/user-data.log

# Check if services are running
pm2 status
```

### Database Connection Failed?
```bash
# Verify credentials
cat /var/www/hope-project/backend/core/.env

# Test Supabase connection
psql "postgresql://USER:PASS@HOST:5432/postgres?sslmode=require"
```

### Services Not Starting?
```bash
# View PM2 logs
pm2 logs

# Restart services
pm2 restart all

# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/hope-error.log
```

### Terraform Apply Fails?
```bash
# Common issues:
# 1. AWS credentials not configured → Run: aws configure
# 2. SSH key not found → Check public_key_path in terraform.tfvars
# 3. Invalid DB credentials → Check db_* variables

# View detailed error
terraform apply -debug
```

---

## 🔄 Update Deployment

### Push Code Changes
```bash
# On local machine
git add .
git commit -m "Your changes"
git push

# SSH to EC2
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_EC2_IP

# Update code
cd /var/www/hope-project
git pull

# Restart services
pm2 restart all
```

---

## 📁 File Structure

```
terraform/
├── main.tf                  # Main infrastructure resources
├── variables.tf             # Input variable definitions
├── outputs.tf               # Output value definitions
├── user-data.sh            # EC2 bootstrap script
├── terraform.tfvars        # Your secret values (NEVER COMMIT!)
├── terraform.tfvars.example # Template (commit this)
├── .gitignore              # Prevent committing secrets
└── README.md               # This file
```

---

## 🔒 Security Best Practices

✅ **DO:**
- Add `terraform.tfvars` to `.gitignore` ✅ (already done)
- Use your actual IP for `ssh_allowed_ips`
- Rotate JWT secret regularly
- Enable AWS MFA
- Use IAM roles instead of access keys (advanced)

❌ **DON'T:**
- Commit `terraform.tfvars` to Git
- Use `0.0.0.0/0` for SSH access in production
- Share your `.pem` private key
- Hardcode passwords in `.tf` files

---

## 📞 Support

**Common Commands:**
```bash
# SSH to instance
ssh -i ~/.ssh/id_rsa ubuntu@$(terraform output -raw instance_public_ip)

# View all outputs
terraform output

# Restart backend
ssh ... "pm2 restart all"

# View logs
ssh ... "pm2 logs hope-gateway"
```

---

## ✅ Success Checklist

After deployment:

- [ ] `terraform apply` completed successfully
- [ ] Wait 10 minutes for bootstrap
- [ ] Check health: `curl http://YOUR_IP/health` returns `{"status":"ok"}`
- [ ] Open `http://YOUR_IP:3000` in browser
- [ ] Can login with test credentials
- [ ] Backend logs show no errors: SSH + `pm2 logs`

**🎉 If all checked, you're LIVE!**

---

## 📚 Additional Resources

- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 Pricing](https://aws.amazon.com/ec2/pricing/on-demand/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

---

**Deployed with ❤️ using Terraform**
