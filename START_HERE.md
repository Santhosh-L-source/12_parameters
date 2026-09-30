# 🌟 HOPE PROJECT - Microservices & Unified API Gateway Architecture

## 🚀 **System Overview**

HOPE (**Holistic Outcome-based Performance Evaluation**) has been organized into a robust microservices backend with a central **API Gateway** on port `3005` and a modern **React SPA Frontend** on port `3000`.

---

## 🏗️ **Architecture & Port Allocation**

```
HOPE_PROJECT/
├── frontend-react/                  (Port 3000 - Vite React SPA)
│   ├── src/pages/                   (Dashboard, Login, Admin, Mentor, 12 Module Pages)
│   └── src/services/api.js          (Unified API client communicating with Port 3005)
│
├── backend/
│   ├── core/                        (Port 3005 - Central API Gateway & Orchestrator)
│   │   ├── src/routes/              (authRoutes, adminRoutes, mentorRoutes, module routes)
│   │   ├── src/middleware/          (JWT Auth, RBAC: requireRole('admin' | 'mentor'))
│   │   └── src/models/              (Sequelize ORM connected to Supabase PostgreSQL)
│   │
│   ├── services/                    (12 Independent Microservices)
│   │   ├── coding-platform/         (Port 3000)
│   │   ├── cp-rating/               (Port 3001)
│   │   ├── open-source/             (Port 3002)
│   │   ├── competition/             (Port 3003)
│   │   ├── internship-startup/      (Port 3004)
│   │   ├── project-pub-patent/      (Port 3005)
│   │   ├── foreign-language/        (Port 3006)
│   │   ├── gate-exam/               (Port 3007)
│   │   ├── monthly-coding/          (Port 3008)
│   │   ├── 100days/                 (Port 3009)
│   │   ├── aptitude-comm/           (Port 3010)
│   │   └── certificate-achievement/ (Port 3011)
│   │
│   └── start-all-microservices.js   (Multi-process runner for all 12 services)
```

---

## 🟢 **Live Server Endpoints**

| Service | Port | Status | Description |
| :--- | :--- | :--- | :--- |
| **Frontend React Portal** | `http://localhost:3000` | 🟢 Active | Student, Mentor, and Admin interfaces |
| **Central API Gateway** | `http://localhost:3005` | 🟢 Active | Auth, Scores Matrix, RBAC, Gateway Proxy |
| **Gateway Health Check** | `http://localhost:3005/health` | 🟢 Active | JSON health status & DB connection check |

---

## 🔐 **Role-Based Access Control & Test Credentials**

All roll numbers and usernames support **case-insensitive** input (e.g. `24cs360` or `24CS360`).

### 1. 🎓 Student Account
- **Username / Roll No:** `24CS360` (or lowercase `24cs360`)
- **Password:** `312324104001`
- **Permissions:** View personal 250-mark dashboard, submit evidence across 12 modules. Blocked from `/admin` and `/mentor`.

### 2. 👨‍🏫 Mentor Account (Department Mentor)
- **Username:** `MENTOR_CSE` (or `mentor_cse`, `mentor_it`, `mentor_ece`)
- **Password:** `mentor123`
- **Permissions:** View assigned mentees, review pending submissions, approve/reject student evidence, award marks. Blocked from `/admin`.

### 3. 🛡️ Admin Account (Super Admin)
- **Username:** `ADMIN` (or `admin`)
- **Password:** `admin123`
- **Permissions:** Full 2,331 student score matrix across all 12 modules, assign/reassign mentors, readiness tier filters, and full system control.

---

## 🏆 **Readiness Tier Classification (out of 250 Marks)**

- **< 80 Marks:** *Not Eligible*
- **80 – 119 Marks:** *Level 1 (Foundation Ready)*
- **120 – 159 Marks:** *Level 2 (Placement Ready)*
- **160 – 199 Marks:** *Level 3 (High-Tier Product Ready)*
- **200+ Marks:** *Elite Tier*

---

## 🛠️ **How to Run**

### 1. Start the API Gateway & Frontend (Standard Mode):
```bash
# Terminal 1: Backend Gateway
cd backend/core
node src/index.js

# Terminal 2: React Frontend
cd frontend-react
npm run dev
```

### 2. Start All 12 Independent Microservices Concurrently:
```bash
cd backend
node start-all-microservices.js
```
