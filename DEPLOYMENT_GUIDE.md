# 🚀 HOPE Project - EC2 Deployment Guide

## Prerequisites

1. **AWS Account** with EC2 access
2. **EC2 Instance**: Ubuntu 22.04, t3.medium, 20GB storage
3. **EC2 Security Group** open ports:
   - SSH (22) - Your IP only
   - HTTP (80) - 0.0.0.0/0
   - HTTPS (443) - 0.0.0.0/0 (optional, for SSL later)
4. **Supabase Database** credentials ready

---

## Step 1: Launch EC2 Instance (AWS Console)

### Option A: Using AWS Console (Easy)

1. Go to **EC2 Dashboard** → **Launch Instance**
2. Configure:
   - **Name**: `hope-project-backend`
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance Type**: `t3.medium`
   - **Key Pair**: Create new or use existing (download `.pem` file)
   - **Storage**: 20 GB gp3
   - **Security Group**: Create new with rules:
     - SSH (22) from My IP
     - HTTP (80) from Anywhere
     - HTTPS (443) from Anywhere
3. Click **Launch Instance**
4. Wait ~2 minutes for instance to start
5. Copy the **Public IPv4 address**

### Connect to EC2:
```bash
# Make key private (one time)
chmod 400 your-key.pem

# SSH into EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## Step 2: Run Automated Setup (On EC2)

Once logged into your EC2 instance, run these commands:

### 2.1 Initial Setup
```bash
# Download deployment scripts
sudo apt update && sudo apt install -y git
git clone YOUR_GITHUB_REPO_URL hope-project
cd hope-project

# Make scripts executable
chmod +x deploy/*.sh

# Run initial setup (installs Node.js, Nginx, PM2, etc.)
./deploy/ec2-setup.sh
```

**⏱️ Time: ~5 minutes**

---

### 2.2 Configure Environment Variables
```bash
# Configure all .env files
./deploy/configure-env.sh
```

**You'll be asked for:**
- Supabase Database Host
- Database Name (usually `postgres`)
- Database User
- Database Password
- Backend URL (use `http://YOUR_EC2_PUBLIC_IP`)

**⏱️ Time: ~2 minutes**

---

### 2.3 Install Dependencies
```bash
# Install all npm packages
./deploy/install-deps.sh
```

**⏱️ Time: ~10 minutes** (large `node_modules` download)

---

### 2.4 Start All Services
```bash
# Start API Gateway + 12 Microservices with PM2
./deploy/start-services.sh
```

**⏱️ Time: ~30 seconds**

You should see:
```
✅ All services started successfully!
📊 Service Status:
┌─────────────────────────┬────┬──────┬───────┐
│ name                    │ id │ mode │ status│
├─────────────────────────┼────┼──────┼───────┤
│ hope-gateway            │ 0  │ fork │ online│
│ service-coding-platform │ 1  │ fork │ online│
│ service-cp-rating       │ 2  │ fork │ online│
...
```

---

### 2.5 Setup Nginx Reverse Proxy
```bash
# Configure Nginx
./deploy/setup-nginx.sh
```

**⏱️ Time: ~30 seconds**

---

## Step 3: Test Backend

```bash
# Test health endpoint
curl http://localhost:3005/health

# Should return:
# {"status":"ok","database":"connected"}
```

**Test from your browser:**
```
http://YOUR_EC2_PUBLIC_IP/health
```

---

## Step 4: Deploy Frontend (On Your Local Machine)

### 4.1 Update Frontend Environment
```bash
# On your local machine, in the project folder
cd frontend-react

# Update .env.production
echo "VITE_API_URL=http://YOUR_EC2_PUBLIC_IP" > .env.production
```

### 4.2 Build Frontend
```bash
npm install
npm run build
```

**Output:** `frontend-react/dist/` folder

---

### 4.3 Option A: Quick Test (Host on EC2)

```bash
# On EC2, install serve
sudo npm install -g serve

# Upload dist folder to EC2
# On local machine:
scp -i your-key.pem -r frontend-react/dist ubuntu@YOUR_EC2_IP:/home/ubuntu/

# On EC2, serve frontend on port 3000
serve -s /home/ubuntu/dist -l 3000
```

**Access:** `http://YOUR_EC2_IP:3000`  
(Open port 3000 in Security Group)

---

### 4.4 Option B: Production Setup (S3 + CloudFront)

**For proper production frontend hosting (recommended):**

1. **Create S3 Bucket:**
```bash
aws s3 mb s3://hope-frontend-YOUR_NAME
aws s3 website s3://hope-frontend-YOUR_NAME --index-document index.html
```

2. **Upload Build:**
```bash
aws s3 sync frontend-react/dist/ s3://hope-frontend-YOUR_NAME --delete
```

3. **Make Public:**
```bash
aws s3api put-bucket-policy --bucket hope-frontend-YOUR_NAME --policy '{
  "Version":"2012-10-17",
  "Statement":[{
    "Sid":"PublicReadGetObject",
    "Effect":"Allow",
    "Principal": "*",
    "Action":["s3:GetObject"],
    "Resource":["arn:aws:s3:::hope-frontend-YOUR_NAME/*"]
  }]
}'
```

4. **Access:** `http://hope-frontend-YOUR_NAME.s3-website-REGION.amazonaws.com`

---

## Step 5: Verify Deployment

### Backend Health Check
```bash
curl http://YOUR_EC2_IP/health
```

### Test Login API
```bash
curl -X POST http://YOUR_EC2_IP/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"24CS360","password":"312324104001"}'
```

**Expected:** JWT token response

### Frontend Test
1. Open `http://YOUR_EC2_IP:3000` (or S3 URL)
2. Try logging in:
   - **Student**: `24CS360` / `312324104001`
   - **Admin**: `admin` / `admin123`

---

## 📊 Managing Services

### View All Services
```bash
pm2 status
```

### View Logs
```bash
pm2 logs                    # All services
pm2 logs hope-gateway       # Specific service
pm2 logs --lines 100        # Last 100 lines
```

### Restart Services
```bash
pm2 restart all             # All services
pm2 restart hope-gateway    # One service
```

### Monitor Real-time
```bash
pm2 monit
```

### Stop Services
```bash
pm2 stop all
pm2 delete all  # Stop and remove
```

---

## 🔒 Security Hardening (After Basic Setup Works)

### 1. Enable HTTPS (Free SSL with Let's Encrypt)
```bash
# Install SSL certificate (requires domain name)
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

### 2. Update CORS in Backend
**File:** `backend/core/src/index.js`

Change:
```javascript
app.use(cors());
```

To:
```javascript
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### 3. Setup Firewall
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 💰 Cost Optimization

### Current Setup Cost: ~$30/month
- **EC2 t3.medium**: ~$30/mo (on-demand)
- **Data Transfer**: ~$1-5/mo
- **S3 + CloudFront**: ~$1-5/mo

### To Reduce Costs:

1. **Use t3.small instead** (~$15/mo) - might work for <50 concurrent users
2. **Reserved Instance** (1-year commit) - Save 30-40%
3. **Spot Instance** - Save up to 70% (but can be interrupted)

---

## 🐛 Troubleshooting

### Services won't start
```bash
# Check logs
pm2 logs hope-gateway --lines 50

# Common issues:
# 1. Database connection failed - check .env credentials
# 2. Port already in use - check: sudo lsof -i :3005
# 3. Missing dependencies - rerun: ./deploy/install-deps.sh
```

### Can't access from browser
```bash
# Check Security Group allows port 80
# Check Nginx is running:
sudo systemctl status nginx

# Check backend is responding:
curl http://localhost:3005/health
```

### Database connection errors
```bash
# Test Supabase connection
psql "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"

# If fails, check:
# 1. Supabase IP allowlist (add EC2 IP)
# 2. Credentials are correct in .env
```

---

## 📞 Need Help?

**Check:**
1. `pm2 logs` for service errors
2. `/var/log/nginx/hope-error.log` for Nginx errors
3. EC2 Security Group rules
4. Supabase database connectivity

**Common Commands:**
```bash
# Restart everything
pm2 restart all && sudo systemctl reload nginx

# Full status check
pm2 status && sudo systemctl status nginx && curl localhost:3005/health
```

---

## ✅ Success Checklist

- [ ] EC2 instance running
- [ ] All 13 services online in `pm2 status`
- [ ] `curl http://localhost:3005/health` returns `{"status":"ok"}`
- [ ] Nginx serves backend on port 80
- [ ] Frontend built and uploaded
- [ ] Can login to frontend with test account
- [ ] File uploads work
- [ ] Student can submit evidence

**🎉 If all checked, you're live!**
