# ⚡ HOPE Project - Quick Start (5 Minutes)

## What I Need From You

### 1. GitHub Repository
Push this code to GitHub so EC2 can clone it:

```bash
# On your local machine, in the HOPE_PROJECT folder:

# If not already a git repo:
git init
git add .
git commit -m "feat: add automated EC2 deployment scripts"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/HOPE_PROJECT.git
git branch -M main
git push -u origin main
```

### 2. AWS EC2 Instance

**Option A: AWS Console (Easiest - 5 mins)**

1. Go to: https://console.aws.amazon.com/ec2/
2. Click **"Launch Instance"**
3. Fill in:
   - **Name**: `hope-backend`
   - **OS**: Ubuntu Server 22.04 LTS
   - **Instance type**: `t3.medium`
   - **Key pair**: Create new → Download `.pem` file (keep it safe!)
   - **Storage**: 20 GB
   - **Security Group**: Allow SSH (22), HTTP (80), HTTPS (443)
4. Click **"Launch"**
5. Wait 2 minutes, then copy the **Public IPv4 address**

**Option B: AWS CLI (If you have it configured)**

```bash
# Create key pair
aws ec2 create-key-pair --key-name hope-key --query 'KeyMaterial' --output text > hope-key.pem
chmod 400 hope-key.pem

# Launch instance (replace SUBNET_ID and SECURITY_GROUP_ID)
aws ec2 run-instances \
  --image-id ami-0f58b397bc5c1f2e8 \
  --instance-type t3.medium \
  --key-name hope-key \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hope-backend}]'
```

### 3. Supabase Credentials (You already have these)
- Database Host: `aws-0-ap-south-1.pooler.supabase.com`
- Database Name: `postgres`
- Database User: `your_user`
- Database Password: `your_password`

---

## Deploy in 5 Steps (15 minutes total)

### Step 1: Connect to EC2
```bash
chmod 400 hope-key.pem
ssh -i hope-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 2: Clone & Setup
```bash
git clone https://github.com/YOUR_USERNAME/HOPE_PROJECT.git
cd HOPE_PROJECT
chmod +x deploy/*.sh
./deploy/ec2-setup.sh
```
**⏱️ 5 minutes** - Installs Node.js, Nginx, PM2

### Step 3: Configure
```bash
./deploy/configure-env.sh
```
**⏱️ 2 minutes** - Enter your Supabase credentials

### Step 4: Install & Start
```bash
./deploy/install-deps.sh    # 5 minutes
./deploy/start-services.sh  # 30 seconds
./deploy/setup-nginx.sh     # 30 seconds
```

### Step 5: Test
```bash
curl http://localhost:3005/health
# Should return: {"status":"ok","database":"connected"}
```

**🎉 Done! Your backend is live at:** `http://YOUR_EC2_IP`

---

## Frontend Deployment (2 options)

### Option A: Quick Test (Host on EC2)
```bash
# On EC2
sudo npm install -g serve
sudo ufw allow 3000/tcp

# On your local machine
cd frontend-react
echo "VITE_API_URL=http://YOUR_EC2_IP" > .env.production
npm run build
scp -i hope-key.pem -r dist ubuntu@YOUR_EC2_IP:/home/ubuntu/

# Back on EC2
serve -s /home/ubuntu/dist -l 3000
```
**Access:** `http://YOUR_EC2_IP:3000`

### Option B: Production (S3 - Recommended)
```bash
# On local machine
aws s3 mb s3://hope-frontend-$(date +%s)
aws s3 sync frontend-react/dist/ s3://YOUR_BUCKET_NAME
aws s3 website s3://YOUR_BUCKET_NAME --index-document index.html
```

---

## That's It!

**Backend:** `http://YOUR_EC2_IP` (or `http://YOUR_EC2_IP:80`)  
**Frontend:** `http://YOUR_EC2_IP:3000` (or S3 URL)

**Test Login:**
- Student: `24CS360` / `312324104001`
- Admin: `admin` / `admin123`

---

## Need Help?

Check logs:
```bash
pm2 logs
pm2 status
sudo tail -f /var/log/nginx/hope-error.log
```

Restart everything:
```bash
pm2 restart all
sudo systemctl reload nginx
```
