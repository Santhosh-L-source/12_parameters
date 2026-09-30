# 🎓 HOPE PROJECT - Complete System

## Holistic Outcome-based Performance Evaluation System

---

## 📁 **Project Structure**

```
HOPE_PROJECT/
│
├── backend/                              ← Backend Services (Node.js + Express)
│   ├── core/                             Main API Server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── authRoutes.js         → Login & JWT Authentication
│   │   │   │   ├── studentRoutes.js      → Student Dashboard APIs
│   │   │   │   └── adminRoutes.js        → Admin APIs
│   │   │   ├── middleware/
│   │   │   │   └── auth.js               → JWT Verification
│   │   │   ├── config/
│   │   │   │   └── database.js           → Supabase Connection
│   │   │   └── index.js                  → Main Server (Port 3005)
│   │   ├── .env                          → Environment Variables
│   │   ├── package.json                  → Dependencies
│   │   └── import-students.js            → Bulk Import Script
│   │
│   ├── monthly_coding/                   Monthly Coding Assessment Module
│   ├── project/                          Project/Publication/Patent Module
│   ├── competition/                      Competition Module
│   ├── hundred_days/                     100 Days Training Module
│   ├── coding_problems/                  Coding Problems Module
│   ├── cp_rating/                        CP Rating Module
│   ├── opensource/                       Open Source Module
│   ├── internship/                       Internship/Startup Module
│   ├── language/                         Foreign Language Module
│   ├── gate/                             GATE/Placement Exam Module
│   ├── aptitude/                         Aptitude & Communication Module
│   └── certificate/                      Certificate Achievement Module
│
├── frontend/                             ← Frontend Web Portal (HTML/CSS/JS)
│   ├── common/                           Shared Components
│   │   ├── index.html                    → Login Page
│   │   ├── dashboard.html                → Student Dashboard
│   │   ├── styles.css                    → Global Styles
│   │   ├── app.js                        → Login Logic
│   │   └── dashboard.js                  → Dashboard Logic
│   │
│   ├── monthly_coding/                   Monthly Coding Frontend
│   ├── project/                          Project Frontend
│   ├── competition/                      Competition Frontend
│   ├── hundred_days/                     100 Days Frontend
│   ├── coding_problems/                  Coding Problems Frontend
│   ├── cp_rating/                        CP Rating Frontend
│   ├── opensource/                       Open Source Frontend
│   ├── internship/                       Internship Frontend
│   ├── language/                         Language Frontend
│   ├── gate/                             GATE Frontend
│   ├── aptitude/                         Aptitude Frontend
│   └── certificate/                      Certificate Frontend
│
├── database/                             ← Database Scripts (PostgreSQL)
│   ├── migrations/
│   │   ├── CORE_TABLES_MIGRATION_V3.sql  → Create 25 tables
│   │   ├── FINAL_PROJECT_EVIDENCE_MIGRATION_V3.sql
│   │   └── ...
│   ├── queries/
│   │   └── DATABASE_VISUALIZATION.sql    → Useful queries
│   └── seed/
│       └── initial_data.sql              → Seed data
│
└── docs/                                 ← Documentation
    ├── README.md                         → This file
    ├── SETUP_GUIDE.md                    → Installation guide
    ├── API_DOCUMENTATION.md              → API reference
    └── ...
```

---

## 🎯 **System Overview**

### **12 Modules (250 Total Marks)**

| Module | Max Marks | Type |
|--------|-----------|------|
| Monthly Coding Assessment | 20 | Bulk Upload |
| Project/Publication/Patent | 30 | Evidence |
| Competition | 20 | Evidence |
| 100 Days Training | 15 | Manual Entry |
| Coding Problems | 25 | Evidence |
| CP Rating | 20 | Evidence |
| Open Source | 20 | Evidence |
| Internship/Startup | 20 | Evidence |
| Foreign Language | 15 | Double Verification |
| GATE/Placement Exam | 25 | Double Verification |
| Aptitude & Communication | 20 | Double Verification |
| Certificate Achievement | 20 | Double Verification |

---

## 🚀 **Quick Start**

### **1. Start Backend**

```bash
cd HOPE_PROJECT/backend/core
npm install
node src/index.js
```

**Backend runs on:** http://localhost:3005

---

### **2. Start Frontend**

```bash
cd HOPE_PROJECT/frontend/common
python -m http.server 8080
```

**Frontend runs on:** http://localhost:8080

---

### **3. Import Students** (One-time)

```bash
cd HOPE_PROJECT/backend/core
node import-students.js
```

**Imports:** 2,331 students  
**Time:** 3-5 minutes  
**Creates:** Login credentials (Roll No + Register No)

---

### **4. Access System**

**Open Browser:** http://localhost:8080

**Login Credentials:**
- Username: Roll Number (e.g., `24CS360`)
- Password: Register Number (e.g., `312324104001`)

---

## 📊 **Database**

### **Provider:** Supabase PostgreSQL

### **Tables:** 25 total
- 5 Core tables (students, parameters, scores, audit_log, mentors)
- 8 Evidence tables
- 6 Submission tables
- 5 Supporting tables
- 1 Utility table

### **Connection:**
```
Host: aws-0-ap-south-1.pooler.supabase.com
Port: 5432
Database: postgres
```

---

## 🔐 **Authentication**

### **Login Flow:**
1. Student enters Roll Number + Register Number
2. Backend verifies credentials (bcrypt)
3. Generates JWT token (24h expiry)
4. Returns token + student profile
5. All API calls include JWT in Authorization header

### **Security Features:**
- ✅ Bcrypt password hashing
- ✅ JWT authentication
- ✅ Protected API routes
- ✅ Audit logging
- ✅ Transaction safety

---

## 📱 **Student Portal Features**

### **Dashboard Shows:**
- ✅ Student name, roll number, register number
- ✅ Email, department, college
- ✅ Total marks (X / 250)
- ✅ Completed modules (X / 12)
- ✅ Percentage
- ✅ All 12 modules with individual scores
- ✅ Module status (Completed/Pending)

---

## 🛠️ **Technology Stack**

### **Backend:**
- Node.js + Express.js
- PostgreSQL (Supabase)
- JWT (jsonwebtoken)
- bcrypt (password hashing)
- multer (file uploads)
- xlsx (Excel parsing)

### **Frontend:**
- HTML5 + CSS3 + Vanilla JavaScript
- Responsive design
- REST API integration
- LocalStorage for token

### **Database:**
- PostgreSQL 15
- Row Level Security (RLS)
- Foreign keys, indexes
- Atomic transactions

---

## 📚 **API Endpoints**

### **Public (No Authentication)**
```
POST /api/auth/login
→ Login with roll number and register number
→ Returns: JWT token + student profile
```

### **Protected (Requires JWT)**
```
GET /api/student/dashboard
→ Returns: Profile + marks summary

GET /api/student/profile
→ Returns: Student details

GET /api/student/marks
→ Returns: All module marks

GET /api/student/marks/:parameter
→ Returns: Specific module marks

GET /api/student/evidence
→ Returns: Submitted evidence
```

### **Admin**
```
POST /api/admin/upload-monthly-coding
→ Bulk upload marks from Excel
→ Body: form-data (file, semester, month, uploadedBy)

GET /api/admin/monthly-coding-summary
→ Returns: Upload statistics
```

---

## 🎨 **Module Development Guide**

### **Adding a New Module:**

1. **Create Backend Structure:**
```bash
mkdir -p backend/new_module/{routes,controllers,models,middleware}
```

2. **Create Frontend Structure:**
```bash
mkdir -p frontend/new_module/{pages,components,styles}
```

3. **Implement Backend:**
- Define routes in `routes/newModuleRoutes.js`
- Business logic in `controllers/newModuleController.js`
- Data models in `models/newModule.js`

4. **Implement Frontend:**
- Create pages in `pages/`
- Build components in `components/`
- Style in `styles/`

5. **Register Routes:**
- Import module routes in `backend/core/src/index.js`
- Add links in `frontend/common/dashboard.html`

---

## 🧪 **Testing**

### **Test Backend:**
```bash
curl http://localhost:3005/health
```

### **Test Login:**
```bash
curl -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"24CS360","password":"312324104001"}'
```

### **Test Dashboard** (use token from login):
```bash
curl http://localhost:3005/api/student/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📦 **Deployment**

### **Backend (Production):**
1. Set environment variables in .env
2. Install dependencies: `npm install --production`
3. Start server: `NODE_ENV=production node src/index.js`
4. Or use PM2: `pm2 start src/index.js --name hope-api`

### **Frontend (Production):**
1. Update API_BASE_URL in JS files
2. Deploy to hosting (Netlify, Vercel, etc.)
3. Or serve via Nginx/Apache

---

## 🔧 **Environment Variables**

```env
# Server
PORT=3005

# Database
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=postgres
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_DIALECT=postgres

# Authentication
JWT_SECRET=your-super-secret-key-min-32-chars
```

---

## 📊 **System Stats**

- **Total Students:** 2,331
- **Total Modules:** 12
- **Total Marks:** 250
- **Database Tables:** 25
- **API Endpoints:** 15+
- **Backend Modules:** 13 (core + 12 modules)
- **Frontend Modules:** 13 (common + 12 modules)

---

## 🆘 **Troubleshooting**

### **Backend won't start:**
```bash
# Check port
netstat -ano | findstr :3005

# Kill existing process
taskkill /PID <PID> /F

# Check database connection
curl http://localhost:3005/health
```

### **Frontend can't connect:**
1. Check backend is running
2. Check CORS enabled
3. Update API_BASE_URL in JS files
4. Check browser console for errors

### **Login fails:**
1. Import students first
2. Check credentials match Excel
3. Check JWT_SECRET in .env
4. Check database has student records

---

## 📝 **Contributing**

### **Code Style:**
- Use modular structure
- Follow naming conventions
- Add comments for complex logic
- Write tests for new features

### **Git Workflow:**
1. Create feature branch
2. Make changes
3. Test thoroughly
4. Create pull request
5. Code review
6. Merge to main

---

## 📄 **License**

Copyright © 2026 HOPE Project. All rights reserved.

---

## 👥 **Team**

Developed for St. Joseph's College of Engineering

---

## 📞 **Support**

For issues or questions:
1. Check documentation in `docs/`
2. Review API documentation
3. Check troubleshooting guide
4. Contact system administrator

---

**Last Updated:** 2026-09-28  
**Version:** 1.0  
**Status:** ✅ Production Ready
