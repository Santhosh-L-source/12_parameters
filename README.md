# 🎓 Project HOPE - Holistic Outcome-Based Performance Evaluation System

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Express.js](https://img.shields.io/badge/Express.js-4.18-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Vercel](https://img.shields.io/badge/Deployment-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

---

## 📖 Table of Contents
1. [Executive Overview](#-executive-overview)
2. [High-Level System Architecture & Flow](#-high-level-system-architecture--flow)
3. [End-to-End Connection Map](#-end-to-end-connection-map-from-where-to-where)
4. [The 12 Deterministic Parameters (250 Marks Total)](#-the-12-deterministic-parameters-250-marks-total)
5. [Role-Based Portals & Functional Modules](#-role-based-portals--functional-modules)
   - [Student Portal](#1-student-portal)
   - [Faculty Mentor Portal](#2-faculty-mentor-portal)
   - [Admin Control & Academic Center](#3-admin-control--academic-center)
6. [External Platform Scrapers & Automated Sync](#-external-platform-scrapers--automated-sync)
7. [Database Schema & Data Models](#-database-schema--data-models)
8. [Project Directory & File Structure](#-project-directory--file-structure)
9. [Local Development & Setup Guide](#-local-development--setup-guide)
10. [Production Deployment Architecture](#-production-deployment-architecture)

---

## 🌟 Executive Overview

**Project HOPE (Holistic Outcome-based Performance Evaluation)** is an institutional-grade academic and career readiness evaluation engine designed for engineering institutions. It automates the tracking, evidence verification, and deterministic score computation across **12 multifaceted parameters** totaling **250 marks**.

### Key Highlights:
- **4,850+ Active Students** categorized across **2nd Year (2029 Batch)** and **3rd Year (2028 Batch)**.
- **23 Department-Specific Faculty Mentors** with partitioned mentee allocation.
- **Automated Live Sync**: Real-time scrapers for LeetCode, CodeChef, Codeforces, GitHub, and SkillRack.
- **Proof Storage & Document Viewer**: Embedded in-app PDF and Image preview modals backed by persistent data encoding.
- **Background Ingestion Worker**: Asynchronous Excel batch processing capable of computing thousands of assessment records in under 2 seconds.

---

## 🏗️ High-Level System Architecture & Flow

```mermaid
flowchart TB
    subgraph Client Layer ["🖥️ Frontend Client (React 18 + Vite)"]
        UI_Login["🔐 Login Page"]
        UI_Student["🎓 Student Dashboard (12 Modules)"]
        UI_Mentor["👨‍🏫 Mentor Verification Queues"]
        UI_Admin["⚙️ Admin Control (3rd & 2nd Year Tabs)"]
        UI_Viewer["📄 Document Viewer Modal"]
    end

    subgraph APILayer ["⚡ API Gateway & Serverless Layer (Express.js)"]
        Auth_MW["🔒 JWT Auth Middleware (authenticate / requireRole)"]
        Router_Auth["/api/auth"]
        Router_Student["/api/student"]
        Router_Mentor["/api/mentor"]
        Router_Admin["/api/admin"]
        Router_Modules["12 Module Routers (/api/language, /api/gate, etc.)"]
        Router_Upload["/api/upload (Persistent Data URI Generator)"]
    end

    subgraph Scrapers ["🌐 External Platform Connectors"]
        Scraper_LC["LeetCode GraphQL Engine"]
        Scraper_CC["CodeChef HTML/JSON Parser"]
        Scraper_CF["Codeforces Official REST API"]
        Scraper_GH["GitHub REST/GraphQL API"]
        Scraper_SR["SkillRack Parser"]
    end

    subgraph Engine ["🧮 HOPE Deterministic Scoring Engine"]
        Score_Calc["Score Calculation & Tier Classifier"]
        Job_Worker["Async Batch Ingestion Worker"]
        Anomaly_Detect["Integrity & Anomaly Detection Engine"]
    end

    subgraph DB ["💾 Database Layer (Supabase PostgreSQL)"]
        DB_Profiles[("profiles (Students, Mentors, Admins)")]
        DB_Scores[("scores (12 Parameters * Marks)")]
        DB_Evidence[("evidence tables (*_evidence)")]
        DB_Jobs[("import_jobs (Bulk Upload Status)")]
    end

    Client Layer -->|Axios / Fetch + JWT Bearer| APILayer
    APILayer --> Auth_MW
    Auth_MW --> Router_Auth
    Auth_MW --> Router_Student
    Auth_MW --> Router_Mentor
    Auth_MW --> Router_Admin
    Auth_MW --> Router_Modules
    Auth_MW --> Router_Upload

    Router_Modules <--> Scrapers
    Router_Modules <--> Engine
    Router_Admin <--> Engine

    Engine <--> DB
    Router_Auth <--> DB
    Router_Student <--> DB
    Router_Mentor <--> DB
    Router_Admin <--> DB
```

---

## 🔄 End-to-End Connection Map: From Where to Where

| # | Step / Action | Origin (Where it starts) | Pathway / Intermediate | Destination (Where it lands) | Stored / Computed In |
|---|---|---|---|---|---|
| **1** | **User Login** | `frontend-react/src/pages/Login.jsx` | `POST /api/auth/login` | `backend/core/src/routes/authRoutes.js` | Authenticates against `profiles` table; returns JWT token + role (`student`, `mentor`, `admin`). |
| **2** | **Student Dashboard** | `frontend-react/src/pages/StudentDashboard.jsx` | `GET /api/student/dashboard` | `backend/core/src/routes/studentRoutes.js` | Aggregates all 12 marks from `scores` table & returns readiness level. |
| **3** | **Platform Sync (CP/OSS)** | `frontend-react/src/pages/modules/CodingProblems.jsx` | `POST /api/coding-problems/sync` | `backend/core/src/routes/codingProblemsRoutes.js` | Invokes external scrapers (LeetCode, CodeChef, Codeforces); computes deterministic score and inserts into `scores`. |
| **4** | **Certificate Upload** | `frontend-react/src/components/FileUpload.jsx` | `POST /api/upload` | `backend/core/src/routes/uploadRoutes.js` | Encodes file into persistent Data URI; returned to form. |
| **5** | **Evidence Submission** | `frontend-react/src/pages/modules/Certificate.jsx` | `POST /api/certificate/submit` | `backend/core/src/routes/certificateRoutes.js` | Inserts record into `certificate_evidence` with `status = 'PENDING'`. |
| **6** | **Document Preview** | Any View Button (`Certificate.jsx`, `FileUpload.jsx`, etc.) | Local State / `DocumentViewerModal.jsx` | In-App Modal / Embedded IFrame | Renders Base64 PDF / Image directly without HTTP roundtrips or 404s. |
| **7** | **Mentor Verification** | `frontend-react/src/pages/mentor/CertificateReview.jsx` | `POST /api/certificate/:id/verify` | `backend/core/src/routes/certificateRoutes.js` | Updates evidence status to `VERIFIED`; triggers score calculation into `scores` table. |
| **8** | **Admin Batch Upload** | `frontend-react/src/pages/AdminDashboard.jsx` (Uploader) | `POST /api/admin/upload-monthly-coding` | `backend/core/src/routes/adminRoutes.js` | Dispatches background worker `import_jobs`; processes 2,500+ Excel rows in bulk. |
| **9** | **Admin Cohort Split** | `frontend-react/src/pages/AdminDashboard.jsx` (3rd / 2nd Year Tabs) | `GET /api/admin/mentors?year=2` or `?year=3` | `backend/core/src/routes/adminRoutes.js` | Queries `profiles` with `mentor_year` & counts assigned mentees partitioned by batch. |

---

## 🎯 The 12 Deterministic Parameters (250 Marks Total)

Each parameter is calculated using deterministic rules without ambiguous rounding:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       HOPE 250 MARKS DISTRIBUTION                           │
├────────────────────────────────┬────────────┬───────────────────────────────┤
│ Parameter                      │ Max Marks  │ Resolution Strategy           │
├────────────────────────────────┼────────────┼───────────────────────────────┤
│ 1. Project / Pub / Patent      │   30 M     │ SUM distinct entities (cap 30)│
│ 2. Coding Problems Solved      │   25 M     │ Dual threshold (Total + SQL)  │
│ 3. GATE Examination            │   25 M     │ Core marks + branch bonus     │
│ 4. Hackathons & Competitions   │   20 M     │ SUM distinct event stages     │
│ 5. Internship & Startup        │   20 M     │ SUM distinct company stages   │
│ 6. Skill Certifications        │   20 M     │ Highest tier per cred (cap 20)│
│ 7. Aptitude & Communication    │   20 M     │ Best Apt (15) + Best Comm (5) │
│ 8. Competitive Programming (CP)│   20 M     │ Best rating across platforms  │
│ 9. Open Source Contributions   │   20 M     │ SUM distinct repos (cap 20)   │
│ 10. Monthly Coding Assessment  │   20 M     │ Tiered average % per semester │
│ 11. 100 Days of Code Training  │   15 M     │ Milestone tier on days done   │
│ 12. Foreign Language           │   15 M     │ Max proficiency (A1, A2, B1)  │
├────────────────────────────────┼────────────┼───────────────────────────────┤
│ TOTAL MAXIMUM MARKS            │  250 MARKS │ DETERMINISTIC AGGREGATION     │
└────────────────────────────────┴────────────┴───────────────────────────────┘
```

### Readiness Tiers
- 👑 **Elite Tier (200 - 250 Marks)**: Top product companies, R&D labs, and leadership fellowships.
- 🚀 **Level 3 - High Product Ready (160 - 199 Marks)**: Tier-1 product developers and core engineering.
- 💼 **Level 2 - Placement Ready (120 - 159 Marks)**: Standard campus placement and tech consultancy ready.
- 🌱 **Level 1 - Foundation Ready (80 - 119 Marks)**: Fundamental software development competency.
- ⚠️ **Not Eligible (< 80 Marks)**: Requires intensive remedial mentoring.

---

## 👥 Role-Based Portals & Functional Modules

### 1. Student Portal
- **Dashboard (`/dashboard`)**:
  - Live progress radial gauge out of 250 marks.
  - 12 module summary cards with direct drill-down links.
  - Profile platform handle linking (LeetCode, CodeChef, Codeforces, GitHub, SkillRack).
- **12 Dedicated Submission Pages (`/modules/*`)**:
  - Direct form entry with validation.
  - Drag-and-drop proof document upload with instant preview.
  - Real-time submission history table with status badges (`PENDING`, `VERIFIED`, `REJECTED`).
  - Embedded **`📄 View Certificate`** button opening the in-app modal.

### 2. Faculty Mentor Portal
- **Mentor Overview (`/mentor`)**:
  - Assigned mentee roster for the mentor's department.
  - Average readiness score and tier distribution charts.
- **12 Verification Queues (`/mentor/review/*`)**:
  - Side-by-side inspection of student claims and attached proof documents.
  - Interactive approval or rejection with mandatory feedback notes.
  - Real-time recalculation of student score on action.

### 3. Admin Control & Academic Center (`/admin`)
- **Dedicated Academic Year Tabs**:
  - 📙 **3rd Year Cohorts (2028 Batch)**: 11 Faculty Mentors (`MENTOR_3RD_...`) & 2,254 students.
  - 📘 **2nd Year Cohorts (2029 Batch)**: 12 Faculty Mentors (`MENTOR_2ND_...`) & 2,598 students.
- **Mentor Cohort Inspector**:
  - Drill down into any mentor's cohort to see the full student score matrix.
  - Multi-select batch re-assignment tool.
  - Auto-assign unassigned students by department with a single click.
- **Batch Score Ingestion (`/admin` Uploader)**:
  - Supports department Excel spreadsheets (`.xlsx`).
  - Asynchronous background worker (`import_jobs`) with progress percentage bar.
- **12-Parameter Rules Reference**:
  - Complete transparent rules matrix.

---

## 🌐 External Platform Scrapers & Automated Sync

The backend contains specialized scrapers in `backend/core/src/scrapers/`:

| Platform | Scraper Engine | Metrics Extracted | Auth / Headers |
|---|---|---|---|
| **LeetCode** | GraphQL Query to `https://leetcode.com/graphql` | Total Solved, Easy/Medium/Hard, Contest Rating | Public Profile GraphQL |
| **CodeChef** | HTML Parser / API to `https://www.codechef.com/users/` | Stars (1★ - 7★), Current Rating, Global Rank | User-Agent Mimic + DOM Parser |
| **Codeforces** | Official REST API `https://codeforces.com/api/user.info` | Rating, Max Rating, Rank, Solved Count | Direct JSON API |
| **GitHub** | REST API `https://api.github.com/users/:username` | Public Repos, Commits, PRs, Stars, Contributions | Optional GitHub PAT Token |
| **SkillRack** | Profile Scraper | Total Solved, Daily Challenges, Medals | Cheerio DOM Traversal |

---

## 🗄️ Database Schema & Data Models

The database runs on **Supabase PostgreSQL** with connection pooling.

```
                    ┌─────────────────────────┐
                    │        profiles         │
                    │─────────────────────────│
                    │ id_number (PK)          │
                    │ register_number         │
                    │ name, email             │
                    │ role (student/mentor/ad)│
                    │ department, college     │
                    │ mentor_year (2 / 3)     │
                    │ assigned_mentor_id (FK) ───┐
                    └───────────┬─────────────┘   │ (Self-referencing FK)
                                │                 │
            ┌───────────────────┴─────────────────┴───────────────────┐
            │                                                         │
            ▼                                                         ▼
┌────────────────────────┐                               ┌────────────────────────┐
│         scores         │                               │     evidence tables    │
│────────────────────────│                               │────────────────────────│
│ id (PK)                │                               │ project_pub_patent_evi │
│ register_number (FK)   │                               │ language_evidence      │
│ parameter (module name)│                               │ gate_evidence          │
│ marks (numeric)        │                               │ competition_evidence   │
│ semester, calculated_at│                               │ certificate_evidence   │
└────────────────────────┘                               │ internship_evidence    │
                                                         │ monthly_coding_evidence│
                                                         │ (contains status & URL)│
                                                         └────────────────────────┘
```

---

## 📁 Project Directory & File Structure

```
HOPE_PROJECT/
├── .github/                              ← CI/CD Workflows
├── api/
│   └── index.js                          ← Vercel Serverless Entry Point
├── backend/
│   └── core/
│       ├── src/
│       │   ├── config/
│       │   │   ├── database.js           ← Sequelize Connection to Supabase
│       │   │   ├── seedAdminMentor.js    ← Legacy Admin Seeder
│       │   │   └── seedYearMentors.js    ← 2nd & 3rd Year Mentors Seeder
│       │   ├── middleware/
│       │   │   └── auth.js               ← JWT Verification & Role Guards
│       │   ├── models/                   ← Sequelize Models (Scores, Evidence)
│       │   ├── routes/
│       │   │   ├── adminRoutes.js        ← Admin APIs, Year Filtering, Mentors
│       │   │   ├── authRoutes.js         ← Login & Profile APIs
│       │   │   ├── mentorRoutes.js       ← Mentor Dashboard & Review APIs
│       │   │   ├── studentRoutes.js      ← Student Dashboard Aggregator
│       │   │   ├── uploadRoutes.js       ← Persistent File Upload Handler
│       │   │   ├── certificateRoutes.js  ← Certificate Module API
│       │   │   ├── languageRoutes.js     ← Foreign Language Module API
│       │   │   ├── competitionRoutes.js  ← Hackathons Module API
│       │   │   ├── internshipRoutes.js   ← Internship Module API
│       │   │   ├── gateExamRoutes.js     ← GATE Exam Module API
│       │   │   ├── codingProblemsRoutes.js ← Scraper Sync & Coding Problems
│       │   │   ├── cpRatingRoutes.js     ← CP Rating Sync API
│       │   │   ├── openSourceRoutes.js   ← GitHub OSS Sync API
│       │   │   ├── monthlyCodingRoutes.js← Monthly Coding Assessment API
│       │   │   ├── hundredDaysRoutes.js  ← 100 Days Module API
│       │   │   ├── aptitudeCommunicationRoutes.js
│       │   │   └── projectPubPatentRoutes.js
│       │   ├── scrapers/                 ← Platform Scrapers (LC, CC, CF, GH, SR)
│       │   └── index.js                  ← Main Express Server (Port 3005)
│       └── package.json
│
├── frontend-react/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx                ← Global Navigation Bar & User Profile
│   │   │   ├── ProtectedRoute.jsx        ← Role-Based Route Guard
│   │   │   ├── FileUpload.jsx            ← Drag & Drop Document Uploader
│   │   │   └── DocumentViewerModal.jsx   ← Embedded PDF/Image Preview Modal
│   │   ├── pages/
│   │   │   ├── Login.jsx                 ← Unified Authentication Portal
│   │   │   ├── StudentDashboard.jsx      ← Student Performance Hub
│   │   │   ├── MentorDashboard.jsx       ← Faculty Mentor Overview
│   │   │   ├── AdminDashboard.jsx        ← Academic Center (3rd & 2nd Year Tabs)
│   │   │   ├── mentor/                   ← 12 Mentor Verification Review Queues
│   │   │   └── modules/                  ← 12 Student Module Submission Pages
│   │   ├── services/
│   │   │   └── api.js                    ← Axios API Client with JWT Interceptor
│   │   ├── App.jsx                       ← React Router Route Definitions
│   │   ├── main.jsx                      ← React DOM Entry Point
│   │   └── index.css                     ← Global Design System & Variables
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── vercel.json                           ← Serverless Routing Configuration
├── package.json                          ← Root Workspace Configuration
└── README.md                             ← Project Documentation
```

---

## 🛠️ Local Development & Setup Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Supabase / PostgreSQL database**

### 1. Clone the Repository
```bash
git clone https://github.com/Santhosh-L-source/12_parameters.git
cd 12_parameters
```

### 2. Configure Backend Environment
Navigate to `backend/core/` and create `.env`:
```env
PORT=3005
JWT_SECRET=your_super_secret_jwt_key
DATABASE_URL=postgres://postgres.[user]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

### 3. Start Backend Server
```bash
cd backend/core
npm install
node src/index.js
```
*Backend runs on `http://localhost:3005`.*

### 4. Start Frontend Development Server
In a new terminal:
```bash
cd frontend-react
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

### 5. Seed Mentors and Students (If needed)
```bash
cd backend/core
node src/config/seedYearMentors.js
```

---

## 🚀 Production Deployment Architecture

The application is deployed on **Vercel** with a decoupled frontend and serverless API architecture:

- **Frontend Deployment**: Built using Vite (`dist/`) and served globally via Vercel Edge CDN.
- **Backend Deployment**: Handled as an Express serverless function via `api/index.js` configured in `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/uploads/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Live Production Endpoints:
- **Web Application**: `https://12-parameters.vercel.app`
- **Backend API**: `https://hope-backend-psi.vercel.app`

---

## 🔐 Default Test Credentials

| Role | Identifier / Username | Password |
|---|---|---|
| **Admin** | `ADMIN` | `admin123` |
| **3rd Year Mentor (CSE)** | `MENTOR_3RD_CSE` | `mentor123` |
| **2nd Year Mentor (CSE)** | `MENTOR_2ND_CSE` | `mentor123` |
| **3rd Year Student (2028)** | `24CS422` | `312324104257` |
| **2nd Year Student (2029)** | `25AD193` | `312325243001` |

---

## 📜 License
This project is developed for institutional academic evaluation and outcome measurement. All rights reserved.
