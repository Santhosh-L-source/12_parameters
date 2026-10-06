# HOPE Project — 12-Parameters Academic & Placement Tracker
## Comprehensive Technical System & Architecture Documentation

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Complete Technology Stack](#2-complete-technology-stack)
3. [Complete Project Structure](#3-complete-project-structure)
4. [File-by-File Technical Breakdown](#4-file-by-file-technical-breakdown)
5. [Complete Application Flow](#5-complete-application-flow)
6. [Login Flow (Detailed Trace & Sequence Diagram)](#6-login-flow)
7. [Registration & User Onboarding Flow](#7-registration--user-onboarding-flow)
8. [OTP & Email Communication Flow](#8-otp--email-communication-flow)
9. [Password Management Flow](#9-password-management-flow)
10. [JWT & Role-Based Authentication Architecture](#10-jwt--role-based-authentication-architecture)
11. [Database Architecture & ORM Integration](#11-database-architecture--orm-integration)
12. [Complete Database Schema & ER Diagram](#12-complete-database-schema--er-diagram)
13. [Entity & Model Mapping](#13-entity--model-mapping)
14. [Comprehensive REST API Reference](#14-comprehensive-rest-api-reference)
15. [Frontend Architecture & Component Flow](#15-frontend-architecture--component-flow)
16. [Backend Architecture (Modular Monolith + Domain Services)](#16-backend-architecture)
17. [Request → Processing → Response Flow](#17-request--response-flow)
18. [Security & Anti-Fraud Mechanisms](#18-security--anti-fraud-mechanisms)
19. [Configuration & Environment Management](#19-configuration--environment-management)
20. [Complete Dependency Breakdown](#20-complete-dependency-breakdown)
21. [External Services, APIs & Scraping Adapters](#21-external-services-apis--scraping-adapters)
22. [Error Handling & Fault Tolerance](#22-error-handling--fault-tolerance)
23. [Data Validation & Sanitization](#23-data-validation--sanitization)
24. [12-Parameter Business Rules & Scoring Engine (250 Marks)](#24-12-parameter-business-rules--scoring-engine)
25. [Complete Feature-by-Feature Flow](#25-complete-feature-by-feature-flow)
26. [Microservices vs. Modular Monolith Architecture](#26-microservices-vs-modular-monolith-architecture)
27. [Complete Request Trace Examples](#27-complete-request-trace-examples)
28. [End-to-End Data Transformation Flow](#28-end-to-end-data-transformation-flow)
29. [Design Rationale (Why Technologies Were Chosen)](#29-design-rationale)
30. [Component & Service Relationship Maps](#30-component--service-relationship-maps)
31. [Class & Module Relationships](#31-class--module-relationships)
32. [Authentication vs. Authorization](#32-authentication-vs-authorization)
33. [Database Query Execution Flow](#33-database-query-execution-flow)
34. [Application Startup & Bootstrap Flow](#34-application-startup--bootstrap-flow)
35. [Local Build & Development Guide](#35-local-build--development-guide)
36. [Deployment Architecture (Vercel & Cloud Postgres)](#36-deployment-architecture)
37. [Automated Testing Framework](#37-automated-testing-framework)
38. [Logging & Auditing Subsystems](#38-logging--auditing-subsystems)
39. [Performance, Caching & Scalability Analysis](#39-performance-caching--scalability-analysis)
40. [Complete System Architecture Diagram](#40-complete-system-architecture-diagram)
41. [Complete End-to-End Execution Trace](#41-complete-end-to-end-execution-trace)
42. [Interview Preparation Guide & Technical Q&A](#42-interview-preparation-guide--technical-qa)
43. [Important Files Quick Reference](#43-important-files-quick-reference)
44. [API Quick Reference Table](#44-api-quick-reference-table)
45. [Database Tables Quick Reference](#45-database-tables-quick-reference)
46. [Final Project Flow Diagram](#46-final-project-flow-diagram)

---

## 1. Project Overview

### High-Level Summary (Beginner-Friendly)
The **HOPE Project** (Holistic Opportunity & Placement Evaluation) is an automated academic readiness, skill-tracking, and placement evaluation platform designed for higher education institutions. It provides a real-time assessment of students across **12 comprehensive career development parameters** (e.g., Coding Problems, Competitive Programming Rating, Open Source Contributions, Hackathons/Competitions, Internships, GATE/Placements, Projects/Patents, Foreign Languages, Aptitude, Certifications, 100 Days of Code, and Monthly Coding Assessments) totaling a normalized score of **250 marks**.

The system automates the verification and live tracking of coding profiles (LeetCode, Codeforces, CodeChef, AtCoder, HackerRank, GeeksForGeeks, SkillRack, and GitHub), runs cryptographic anti-fraud bio verification, enables faculty mentors to review student submissions, and provides institutional administrators with cohort analytics, batch assignments, and Excel export reports.

### Technical Overview
The project is built as a **Modular Monolith** backend with domain-driven service fetchers and a modern single-page React frontend:
- **Frontend**: React 19 SPA powered by Vite 8 and React Router v7 with role-based routing (`student`, `mentor`, `admin`), dynamic status badges, micro-animations, and live synchronizers.
- **Backend Core**: Node.js / Express server orchestrating RESTful endpoints, JWT authentication, role authorization, file uploads via Multer, and PostgreSQL database queries via Sequelize ORM.
- **Scraping & Verification Engines**: Domain-specific fetchers utilizing Cheerio, Axios, LeetCode GraphQL, Codeforces REST API, AtCoder History JSON API, and GitHub REST/GraphQL APIs with anti-fraud bio token verification.
- **Database**: Cloud PostgreSQL with relational schema, foreign key constraints, indexes, audit triggers, and normalized scores tables.
- **Deployment**: Serverless deployment via Vercel for both API serverless functions (`api/index.js`) and Vite static frontend bundle.

---

## 2. Complete Technology Stack

| Technology | Category | Version | Where Used | Why & How Used |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | Runtime | `>= 18.x` (tested on v22) | Backend (`backend/core`, `backend/services/*`) | Server runtime executing asynchronous JavaScript, routing, database interactions, and web scrapers. |
| **Express.js** | Backend Web Framework | `^4.21.0` | `backend/core/src/index.js`, all route files | Provides REST routing, middleware pipelines (CORS, JSON parsing, Authentication, Multer), error handling, and request dispatching. |
| **React** | Frontend UI Framework | `^19.2.8` | `frontend-react/src/*` | Powers the reactive Single Page Application (SPA), state management, and component hierarchy. |
| **React DOM** | Virtual DOM Renderer | `^19.2.8` | `frontend-react/src/main.jsx` | Mounts the root React component hierarchy to the HTML document DOM. |
| **React Router DOM** | Client-Side Routing | `^7.18.4` | `frontend-react/src/App.jsx` | Handles client routing, protected route guards (`ProtectedRoute`), and redirects based on user roles. |
| **Vite** | Build Tool & Bundler | `^8.3.0` | `frontend-react/vite.config.js` | Fast HMR development server, Rollup production bundler, CSS minifier, and asset optimizer. |
| **PostgreSQL** | Relational Database | `15+` / `16+` | Cloud DB instance | Persistent relational storage for students, mentors, administrators, scores, profiles, evidence, and audit logs. |
| **Sequelize** | ORM / Query Builder | `^6.37.3` | `backend/core/src/config/database.js` | Manages PostgreSQL connection pools, raw parameterized SQL queries, and transaction management. |
| **pg & pg-hstore** | PostgreSQL Driver | `^8.13.0` | `backend/core/node_modules/pg` | Low-level Node.js PostgreSQL client driver with TLS socket support. |
| **jsonwebtoken (JWT)**| Auth & Token Generation | `^9.0.3` | `backend/core/src/middleware/auth.js`, `authRoutes.js` | Issues cryptographically signed HS256 JWT tokens containing `id`, `roll_number`, `role`, and `department`. |
| **bcryptjs** | Password Hashing | `^3.0.3` | `backend/core/src/routes/authRoutes.js` | Salted password hashing (10 salt rounds) and password verification during user logins. |
| **express-validator** | Request Validation | `^7.2.0` | All route files in `backend/core/src/routes/` | Validates and sanitizes incoming request parameters, query params, UUIDs, and JSON request bodies. |
| **Axios** | HTTP Client | `^1.20.0` | `backend/services/*/src/fetchers/`, `frontend-react/src/services/api.js` | Executes outbound HTTP requests for API querying, GraphQL execution, profile scraping, and frontend REST communication. |
| **Cheerio** | HTML Parser / Scraper | `^1.2.0` | `backend/services/coding-platform/src/fetchers/` | Fast server-side jQuery-like DOM parsing for extracting statistics from platforms lacking public JSON APIs (e.g., AtCoder, CodeChef, GeeksForGeeks). |
| **Multer** | Multipart File Upload | `^2.4.0` | `backend/core/src/routes/uploadRoutes.js` | Handles multipart form data for uploading student certificates, project documentation, offer letters, and ID proofs. |
| **ExcelJS & XLSX** | Spreadsheet Processing | `^4.4.0` / `^0.18.5` | `backend/core/src/routes/adminRoutes.js` | Generates structured multi-sheet Excel workbooks (`.xlsx`) containing student performance matrices and cohort statistics. |
| **Nodemailer** | SMTP Email Dispatcher | `^10.0.14` | `backend/core/src/routes/adminRoutes.js` | Sends automated placement reports, student cohort spreadsheets, and performance summaries via institutional SMTP. |
| **CORS** | Cross-Origin Middleware | `^2.8.5` | `backend/core/src/index.js` | Enables secure Cross-Origin Resource Sharing between Vite frontend (`localhost:3000`/Vercel) and Express API. |
| **Dotenv** | Environment Configuration | `^16.4.5` | `backend/core/src/index.js` | Loads environment variables from `.env` files into `process.env`. |

---

## 3. Complete Project Structure

```text
HOPE_PROJECT/
├── api/
│   └── index.js                           # Vercel Serverless entrypoint exporting Express app
├── backend/
│   ├── core/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   └── database.js            # Sequelize PostgreSQL connection pool configuration
│   │   │   ├── middleware/
│   │   │   │   └── auth.js                # JWT verification, Token parsing & RBAC role guards
│   │   │   ├── routes/
│   │   │   │   ├── adminRoutes.js         # Admin cohort management, mentor assignment, excel export
│   │   │   │   ├── anomalyRoutes.js       # Fraud detection, score anomaly inspection routes
│   │   │   │   ├── aptitudeCommunicationRoutes.js # Parameter: Aptitude & Communication
│   │   │   │   ├── authRoutes.js          # Authentication (login, me, logout, password change)
│   │   │   │   ├── certificateRoutes.js   # Parameter: Certificate Achievement
│   │   │   │   ├── codingProblemsRoutes.js# Parameter: Coding Problems (Auto-fetcher & verifier)
│   │   │   │   ├── competitionRoutes.js   # Parameter: Competitions & Hackathons
│   │   │   │   ├── cpRatingRoutes.js      # Parameter: CP Rating (LeetCode, CF, CC, AtCoder)
│   │   │   │   ├── externalRoutes.js      # External webhook & third-party sync routes
│   │   │   │   ├── gateExamRoutes.js      # Parameter: GATE / Placement Exam
│   │   │   │   ├── hundredDaysRoutes.js   # Parameter: 100 Days Training
│   │   │   │   ├── internshipRoutes.js    # Parameter: Internship & Startup
│   │   │   │   ├── languageRoutes.js      # Parameter: Foreign Language Proficiency
│   │   │   │   ├── mentorRoutes.js        # Mentor mentee cohort, approval & rejection workflows
│   │   │   │   ├── monthlyCodingRoutes.js # Parameter: Monthly Coding Assessments
│   │   │   │   ├── openSourceRoutes.js    # Parameter: Open Source Contributions & PR tracking
│   │   │   │   ├── projectPubPatentRoutes.js # Parameter: Project, Publication & Patent
│   │   │   │   ├── studentRoutes.js       # Student profile, readiness metrics & score breakdowns
│   │   │   │   └── uploadRoutes.js        # Document upload handler (PDF, JPG, PNG)
│   │   │   └── index.js                   # Main Express application initialization & route mounting
│   │   └── package.json                   # Backend Core dependencies & metadata
│   └── services/                          # Modular domain services & web scrapers
│       ├── 100days/                       # 100 Days Training domain service
│       ├── aptitude-comm/                 # Aptitude & Communication domain service
│       ├── certificate-achievement/       # Certificate validation domain service
│       ├── coding-platform/               # Scraping engines for LeetCode, Codeforces, CodeChef, AtCoder, HackerRank, GFG, SkillRack
│       ├── competition/                   # Competitions & Hackathons validation service
│       ├── cp-rating/                     # CP Rating aggregation & threshold calculation engine
│       ├── foreign-language/              # Foreign language proficiency verification service
│       ├── gate-exam/                     # GATE score calculation engine
│       ├── internship-startup/            # Internship duration & stipend evaluation service
│       ├── monthly-coding/                # Monthly contest evaluation service
│       ├── open-source/                   # GitHub PR & Open Source contribution tracking service
│       └── project-pub-patent/            # Project & Patent evaluation service
├── database/
│   ├── migrations/                        # SQL migration scripts (000 to 010 + CORE V3)
│   └── queries/                           # Pre-built SQL queries for analytics & verification
├── frontend-react/
│   ├── public/                            # Static public web assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx                 # Global authenticated navigation header
│   │   │   ├── LoadingSkeleton.jsx        # Animated UI loading skeletons
│   │   │   └── ProtectedRoute.jsx         # Role-based route guard component
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx         # Admin institutional analytics, cohorts & exports
│   │   │   ├── Dashboard.jsx              # Student 12-parameter scorecard & readiness tracker
│   │   │   ├── Login.jsx                  # Multi-role authentication interface
│   │   │   ├── MentorDashboard.jsx        # Faculty mentor mentee review & verification portal
│   │   │   ├── mentor/                    # Mentor sub-views
│   │   │   └── modules/                   # Individual 12-parameter interactive student modules
│   │   │       ├── Aptitude.jsx
│   │   │       ├── Certificate.jsx
│   │   │       ├── CodingProblems.jsx
│   │   │       ├── Competition.jsx
│   │   │       ├── CpRating.jsx
│   │   │       ├── Gate.jsx
│   │   │       ├── HundredDays.jsx
│   │   │       ├── Internship.jsx
│   │   │       ├── Language.jsx
│   │   │       ├── MonthlyCoding.jsx
│   │   │       ├── OpenSource.jsx
│   │   │       └── ProjectPubPatent.jsx
│   │   ├── services/
│   │   │   └── api.js                     # Unified Axios API client communicating with backend
│   │   ├── utils/
│   │   │   └── auth.js                    # JWT storage, user session & role extraction helpers
│   │   ├── App.jsx                        # React Router routes definition
│   │   ├── index.css                      # Global design system tokens & base styles
│   │   └── main.jsx                       # Application bootstrapping & React DOM mount
│   ├── package.json                       # Frontend dependencies (React 19, Vite, React Router)
│   ├── vercel.json                        # Frontend SPA routing configuration for Vercel
│   └── vite.config.js                     # Vite build configuration with proxy settings
├── package.json                           # Root monorepo workspace package configuration
├── vercel.json                            # Root Vercel serverless function rewrite rules
└── PROJECT_DOCUMENTATION.md               # Complete System & Architecture Documentation
```

---

## 4. File-by-File Technical Breakdown

### Core Backend & Configuration

#### `backend/core/src/index.js`
- **Purpose**: Main backend application bootstrap and HTTP server initialization.
- **Why it exists**: Configures Express middleware, mounts all 17 RESTful route handlers, connects to PostgreSQL via Sequelize, and starts the listener on port `3005` (or `process.env.PORT`).
- **Used Technologies**: `express`, `cors`, `dotenv`, `path`, `os`, `sequelize`.
- **Key Middleware Registered**:
  - `cors()`: Cross-Origin Resource Sharing.
  - `express.json({ limit: '25mb' })`: Handles JSON request payloads up to 25MB.
  - `express.static()`: Serves static file uploads from temp and local upload directories.
- **Route Registrations**: Mounts `/api/auth`, `/api/admin`, `/api/mentor`, `/api/student`, `/api/upload`, and all 12 individual parameter route modules (`/api/coding-problems`, `/api/cp-rating`, `/api/open-source`, etc.).

#### `backend/core/src/config/database.js`
- **Purpose**: PostgreSQL database connection pool setup and Sequelize instance export.
- **Why it exists**: Centralizes database credentials, dialect options, SSL connections for cloud PostgreSQL (Neon, Supabase, AWS RDS), and connection pool lifecycle settings.
- **Used Technologies**: `sequelize`, `pg`.
- **Processing**: Reads `DATABASE_URL` (or discrete `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`), enables SSL with `rejectUnauthorized: false` for production, sets pool size (max 20, min 2, idle 10000ms), and exports the `sequelize` singleton instance.

#### `backend/core/src/middleware/auth.js`
- **Purpose**: JWT verification and Role-Based Access Control (RBAC) enforcement middleware.
- **Why it exists**: Intercepts incoming requests, verifies the `Authorization: Bearer <token>` header, decodes user credentials, and guards restricted endpoints by role (`student`, `mentor`, `admin`).
- **Key Functions**:
  - `authenticate(req, res, next)`: Validates JWT signature using `process.env.JWT_SECRET`. Attaches `req.user = decoded` to the request object.
  - `authorize(roles)`: Higher-order middleware checking if `roles.includes(req.user.role)`. Rejects unauthorized roles with HTTP 403 Forbidden.

#### `backend/core/src/routes/authRoutes.js`
- **Purpose**: User authentication, credential verification, and profile retrieval.
- **Why it exists**: Implements login for Students, Faculty Mentors, and Administrators with role-specific password checking and JWT issuance.
- **Key Endpoints**:
  - `POST /api/auth/login`: Accepts `username` (Roll Number / ID / Register Number) and `password`. Resolves student/mentor/admin record, validates password using `bcrypt.compare()` (with fallback to seeded plain strings during transition), creates JWT, and updates `last_login`.
  - `GET /api/auth/me`: Decodes JWT token and returns authenticated user metadata and academic details.
  - `POST /api/auth/change-password`: Updates password hash using `bcrypt.hash(new_password, 10)`.

#### `backend/core/src/routes/adminRoutes.js`
- **Purpose**: Institutional administration, cohort analytics, mentor assignments, and Excel export reporting.
- **Why it exists**: Gives college deans and placement directors complete visibility over all students across 14 academic departments.
- **Key Endpoints**:
  - `GET /api/admin/mentors`: Returns all department mentors along with mentee counts filtered by 2nd year (2029 batch) or 3rd year (2028 batch).
  - `POST /api/admin/assign-mentor`: Batch-assigns student IDs to a designated faculty mentor.
  - `POST /api/admin/auto-assign-departments`: Automatically assigns students to their respective department faculty mentor.
  - `GET /api/admin/export-scores`: Generates an Excel (`.xlsx`) workbook of the entire student score matrix using `exceljs`.
  - `POST /api/admin/email-export`: Dispatches the student score matrix spreadsheet to designated recipient emails using `nodemailer`.

#### `backend/core/src/routes/openSourceRoutes.js`
- **Purpose**: Open Source contributions verification, GitHub PR tracking, and scoring.
- **Why it exists**: Validates student GitHub profile ownership via anti-fraud bio verification and tracks live merged PRs across third-party repositories.
- **Key Endpoints**:
  - `POST /api/open-source/verify-ownership`: Verifies temporary bio token (`VERIFY-<ROLL>-<TOKEN>`), extracts merged PRs via GitHub API, records evidence with `status = 'VERIFIED'`, and awards up to 20 marks in `scores` (`parameter_id = 'opensource'`).
  - `POST /api/open-source/sync`: Re-scrapes all verified GitHub accounts and re-calculates contribution marks.
  - `GET /api/open-source/student/:studentId`: Returns student contribution evidence history.

#### `backend/core/src/routes/cpRatingRoutes.js`
- **Purpose**: Competitive Programming contest rating synchronization and single-best rating evaluation.
- **Why it exists**: Aggregates live contest ratings from LeetCode, Codeforces, CodeChef, and AtCoder, determining the student's highest achievement tier.
- **Key Endpoints**:
  - `POST /api/cp-rating/sync-from-coding-platforms`: Automatically fetches live ratings for all verified coding profiles and updates `parameter_id = 'cp_rating'`.
  - `GET /api/cp-rating/marks/:studentId`: Evaluates the single best rating across all platforms and returns awarded marks (up to 20).

---

### Scraping & Verification Engines (`backend/services/coding-platform`)

#### `backend/services/coding-platform/src/fetchers/ratingFetcher.js`
- **Purpose**: Fetches live contest ratings across LeetCode, Codeforces, CodeChef, and AtCoder.
- **Why it exists**: Direct rating extraction engine using platform-specific APIs and HTML parsing.
- **Platform Integrations**:
  - **LeetCode**: Executes GraphQL query `userContestRanking` against `https://leetcode.com/graphql`.
  - **Codeforces**: Queries `https://codeforces.com/api/user.info?handles={handle}`.
  - **CodeChef**: Scrapes `https://www.codechef.com/users/{handle}` for `.rating-number`.
  - **AtCoder**: Fetches `https://atcoder.jp/users/{handle}/history/json` extracting `NewRating` from the latest contest entry.

#### `backend/services/coding-platform/src/fetchers/githubOpenSourceFetcher.js`
- **Purpose**: GitHub account ownership verification and open-source contribution metrics scraper.
- **Why it exists**: Prevents students from claiming repositories they do not own and computes PR stage scores.
- **Key Functions**:
  - `verifyGitHubOwnership(username, expectedToken)`: Checks `https://github.com/{username}` HTML for the token in bio, name, or profile markdown.
  - `fetchGitHubOpenSourceStats(urlOrHandle, expectedAuthor)`: Queries GitHub search API `type:pr+author:{user}+is:merged` and counts PR submissions and merged PRs.

---

### Frontend Single Page Application (`frontend-react/src`)

#### `frontend-react/src/App.jsx`
- **Purpose**: Client-side routing declarations and role-based route guard architecture.
- **Why it exists**: Maps URLs to React page components, enforcing authentication and redirects based on roles (`student`, `mentor`, `admin`).
- **Route Map**:
  - `/login`: Public login portal.
  - `/dashboard`: Student 12-parameter scorecard dashboard.
  - `/mentor/dashboard`: Faculty mentor portal.
  - `/admin/dashboard`: Institutional administrative portal.
  - `/coding-problems`, `/cp-rating`, `/open-source`, etc.: Individual parameter detail pages.

#### `frontend-react/src/services/api.js`
- **Purpose**: Centralized Axios API abstraction layer.
- **Why it exists**: Manages HTTP request headers, token injection (`Authorization: Bearer <token>`), error formatting, and endpoint declarations for all modules.

#### `frontend-react/src/utils/auth.js`
- **Purpose**: Client-side authentication and session storage management.
- **Why it exists**: Manages storage and retrieval of JWT tokens, student metadata, and user roles in `localStorage`.

---

## 5. Complete Application Flow

```mermaid
flowchart TD
    A[User Opens Application in Browser] --> B{Is User Authenticated?}
    B -- No --> C[Render Login Page /login]
    C --> D[User Submits Credentials]
    D --> E[POST /api/auth/login]
    E --> F{Validate in Database}
    F -- Success --> G[Return JWT Token & Role]
    G --> H[Store JWT in localStorage]
    H --> I{Redirect by Role}
    I -- Role: student --> J[Student Dashboard /dashboard]
    I -- Role: mentor --> K[Mentor Portal /mentor/dashboard]
    I -- Role: admin --> L[Admin Analytics /admin/dashboard]
    B -- Yes --> I

    J --> M[View 12-Parameter Readiness Score]
    M --> N[Open Specific Parameter Module e.g., Open Source]
    N --> O[Generate Anti-Fraud Verification Token]
    O --> P[User Pastes Token in External Profile Bio]
    P --> Q[Click Verify & Link Account]
    Q --> R[Backend Scrapes & Validates External Profile]
    R --> S{Token Verified?}
    S -- Yes --> T[Calculate Stage Marks & Insert into DB]
    T --> U[Update Profile Total Readiness Score]
    U --> V[Display Updated Marks on Dashboard]
    S -- No --> W[Display Verification Error Alert]
```

---

## 6. Login Flow

### Step-by-Step Trace
1. **User Interaction**: User visits `/login` in `frontend-react/src/pages/Login.jsx`.
2. **Form Input**: User selects role (Student / Mentor / Admin) and inputs Username (Roll Number / Register Number / Email) and Password.
3. **Frontend Action**: `handleSubmit` in `Login.jsx` calls `authAPI.login({ username, password })`.
4. **HTTP Request**:
   - **Method**: `POST`
   - **URL**: `http://localhost:3005/api/auth/login` (or `/api/auth/login` in production)
   - **Headers**: `Content-Type: application/json`
   - **Body**: `{"username": "24CS422", "password": "password123"}`
5. **Backend Processing (`authRoutes.js`)**:
   - Sanitizes and trims `username`.
   - Queries `students`, `mentors`, or `administrators` table based on username match.
   - Compares password with `bcrypt.compare()` or legacy plain-text fallback.
   - Generates JWT token containing `{ id, roll_number, name, email, role, department }` signed with `JWT_SECRET` and 24-hour expiration.
   - Updates `last_login = NOW()` in database.
6. **HTTP Response**:
   - Status: `200 OK`
   - Body: `{"success": true, "token": "eyJhbGci...", "user": { "roll_number": "24CS422", "name": "SANTHOSH L", "role": "student", "department": "CSE" }}`
7. **Client Storage**: `auth.js` saves `token`, `user`, and `role` to `localStorage`.
8. **Navigation**: Redirects to `/dashboard` (student), `/mentor/dashboard` (mentor), or `/admin/dashboard` (admin).

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Login Page (React)
    participant API as Auth API (Express)
    participant DB as PostgreSQL Database

    User->>UI: Enter Username & Password
    UI->>API: POST /api/auth/login
    API->>DB: SELECT * FROM students/mentors/administrators WHERE roll_number = :username
    DB-->>API: User Record with password_hash
    API->>API: Validate Password (bcrypt.compare)
    API->>API: Generate Signed JWT Token
    API->>DB: UPDATE table SET last_login = NOW()
    API-->>UI: 200 OK { success: true, token, user }
    UI->>UI: Save Token & User in localStorage
    UI-->>User: Redirect to Role Dashboard
```

---

## 7. Registration & User Onboarding Flow

### Implementation Status in Codebase
- **Institutional Student & Mentor Onboarding**: The system is designed for institutional deployment where student and faculty rosters are pre-seeded or batch-imported via administrator Excel/CSV spreadsheets (`students` and `mentors` tables).
- **Batch Enrollment**: Implemented via Admin Batch Upload routes and SQL initialization scripts (`CORE_TABLES_MIGRATION_V3.sql`).
- **Direct Public Self-Registration**: *Not configured in the codebase* (to prevent unauthorized registration outside the college registry).

---

## 8. OTP & Email Communication Flow

### Implementation in Codebase
- **Email Service**: Implemented using `nodemailer` in `backend/core/src/routes/adminRoutes.js`.
- **Purpose**: Automated generation and emailing of academic placement reports and cohort Excel spreadsheets (`.xlsx`) to college deans, department heads, and faculty advisors.
- **Configuration**:
  - Transport: SMTP using `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
  - Fallback: Ethereal email test transport for non-production environments.
- **Workflow**:
  1. Admin navigates to **Admin Dashboard → 📊 Performance Matrix & Student Scores**.
  2. Admin enters recipient email address and selects semester/department filter.
  3. Frontend sends `POST /api/admin/email-export`.
  4. Backend queries the complete student score matrix, generates an `.xlsx` workbook in memory via `exceljs`, and attaches it to an outgoing email.

---

## 9. Password Management Flow

1. **Password Change**: Authenticated users can update their password via `POST /api/auth/change-password`.
2. **Hash Security**: All new passwords are automatically hashed with 10 salt rounds (`bcrypt.hash(newPassword, 10)`).
3. **Database Update**: The hash is saved to `password_hash` column in the respective role table (`students`, `mentors`, or `administrators`).

---

## 10. JWT & Role-Based Authentication Architecture

### Token Structure
- **Algorithm**: `HS256` (HMAC with SHA-256)
- **Token Claims**:
  ```json
  {
    "id": "24CS422",
    "roll_number": "24CS422",
    "id_number": "24CS422",
    "name": "SANTHOSH L",
    "email": "santhosh@hope.edu",
    "role": "student",
    "department": "CSE",
    "iat": 1791256800,
    "exp": 1791343200
  }
  ```

### Authentication Lifecycle
1. **Client Injection**: Every API call executed by `frontend-react/src/services/api.js` automatically attaches the token:
   `Authorization: Bearer <token>`
2. **Middleware Interception**: `backend/core/src/middleware/auth.js` extracts the bearer token, verifies signature against `JWT_SECRET`, and populates `req.user`.
3. **Role Guards**: Endpoints restricted to faculty mentors or administrators use `authorize(['mentor', 'admin'])`. Requests with mismatched roles immediately receive `403 Forbidden`.

---

## 11. Database Architecture & ORM Integration

- **Database Engine**: PostgreSQL 15+
- **Dialect & Connection Pooling**: Managed by Sequelize (`sequelize` package) using `pg` driver.
- **Connection Pool Config**:
  - `max`: 20 connections
  - `min`: 2 connections
  - `idle`: 10000ms
  - `acquire`: 30000ms
- **SSL Enforcement**: Configured with `ssl: { require: true, rejectUnauthorized: false }` for cloud PostgreSQL hosting (Neon, Supabase, AWS RDS).

---

## 12. Complete Database Schema & ER Diagram

```mermaid
erDiagram
    ADMINISTRATORS ||--o{ MENTORS : manages
    MENTORS ||--o{ STUDENTS : guides
    STUDENTS ||--o{ SCORES : earns
    PARAMETERS ||--o{ SCORES : defines
    STUDENTS ||--o| PROFILES : has
    STUDENTS ||--o{ CODING_PROBLEMS_EVIDENCE : submits
    STUDENTS ||--o{ CP_RATING_EVIDENCE : submits
    STUDENTS ||--o{ OPEN_SOURCE_EVIDENCE : submits
    STUDENTS ||--o{ PROJECT_PUB_PATENT_EVIDENCE : submits
    STUDENTS ||--o{ CERTIFICATE_EVIDENCE : submits
    STUDENTS ||--o{ COMPETITION_EVIDENCE : submits
    STUDENTS ||--o{ INTERNSHIP_EVIDENCE : submits

    STUDENTS {
        string roll_number PK
        string register_number
        string name
        string email
        string department
        int year_of_study
        string batch
        string mentor_roll_number FK
    }

    MENTORS {
        string roll_number PK
        string name
        string email
        string department
        string role
    }

    PARAMETERS {
        string id PK
        string name
        float max_marks
        float weightage
        string category
    }

    SCORES {
        uuid id PK
        string roll_number FK
        string parameter_id FK
        float marks
        int semester
        boolean provisional
        timestamp calculated_at
    }

    PROFILES {
        string roll_number PK
        float total_score
        float coding_score
        string readiness_tier
    }
```

### Table Specifications

#### 1. Table: `students`
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `roll_number` | `VARCHAR(50)` | `PRIMARY KEY` | Unique student institutional roll number (e.g. `24CS422`). |
| `register_number` | `VARCHAR(50)` | `UNIQUE, NULLABLE` | University exam registration number. |
| `name` | `VARCHAR(100)` | `NOT NULL` | Full student name. |
| `email` | `VARCHAR(100)` | `UNIQUE, NOT NULL` | Student institutional email address. |
| `department` | `VARCHAR(50)` | `NOT NULL` | Academic department (CSE, IT, AI & DS, ECE, EEE, etc.). |
| `year_of_study` | `INTEGER` | `DEFAULT 3` | Current academic year (2 or 3). |
| `batch` | `VARCHAR(20)` | `DEFAULT '2028'` | Graduation batch year (`2028`, `2029`). |
| `mentor_roll_number`| `VARCHAR(50)` | `REFERENCES mentors(roll_number)` | Assigned faculty mentor roll number. |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Record creation timestamp. |

#### 2. Table: `mentors`
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `roll_number` | `VARCHAR(50)` | `PRIMARY KEY` | Unique mentor ID (e.g. `MTR_CSE`). |
| `name` | `VARCHAR(100)` | `NOT NULL` | Faculty mentor name. |
| `email` | `VARCHAR(100)` | `UNIQUE, NOT NULL` | Mentor official email. |
| `department` | `VARCHAR(50)` | `NOT NULL` | Department managed by mentor. |
| `role` | `VARCHAR(20)` | `DEFAULT 'mentor'` | Role identifier. |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | BCrypt password hash. |

#### 3. Table: `parameters`
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | `PRIMARY KEY` | Parameter identifier (`coding_problems`, `cp_rating`, `opensource`, `competition`, `internship`, `project`, `language`, `gate`, `monthly_coding`, `hundred_days`, `aptitude`, `certificate`). |
| `name` | `VARCHAR(100)` | `NOT NULL` | Human-readable parameter name. |
| `max_marks` | `NUMERIC(5,2)`| `NOT NULL` | Maximum allotable marks for this parameter (20 or 25). |
| `category` | `VARCHAR(50)` | `NOT NULL` | Category group (CODING, COGNITIVE, INDUSTRY, RESEARCH). |

#### 4. Table: `scores`
| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique score record ID. |
| `roll_number` | `VARCHAR(50)` | `REFERENCES students(roll_number), NOT NULL` | Student roll number. |
| `parameter_id` | `VARCHAR(50)` | `REFERENCES parameters(id), NOT NULL` | FK to parameter ID. |
| `marks` | `NUMERIC(5,2)`| `NOT NULL, DEFAULT 0.00` | Awarded score. |
| `semester` | `INTEGER` | `NOT NULL, DEFAULT 1` | Academic semester. |
| `provisional` | `BOOLEAN` | `DEFAULT FALSE` | Flag if evidence is pending mentor verification. |
| `calculated_at` | `TIMESTAMP` | `DEFAULT NOW()` | Calculation timestamp. |

---

## 13. Entity & Model Mapping

The system utilizes direct Sequelize database interaction and mapped Sequelize model definitions:
- `Student` $\leftrightarrow$ Table: `students`
- `Mentor` $\leftrightarrow$ Table: `mentors`
- `Administrator` $\leftrightarrow$ Table: `administrators`
- `Score` $\leftrightarrow$ Table: `scores`
- `Profile` $\leftrightarrow$ Table: `profiles`
- `CodingProblemsEvidence` $\leftrightarrow$ Table: `coding_problems_evidence`
- `CPRatingEvidence` $\leftrightarrow$ Table: `cp_rating_evidence`
- `OpenSourceEvidence` $\leftrightarrow$ Table: `open_source_evidence`
- `ProjectEvidence` $\leftrightarrow$ Table: `project_pub_patent_evidence`

---

## 14. Comprehensive REST API Reference

### Authentication API
- `POST /api/auth/login`: Authenticate user and issue JWT.
- `GET /api/auth/me`: Return authenticated session user profile.
- `POST /api/auth/change-password`: Update authenticated user password.

### Student & Profile API
- `GET /api/student/profile/:rollNumber`: Returns complete student scorecard, 12-parameter marks breakdown, and cohort rank.
- `GET /api/student/readiness/:rollNumber`: Returns career readiness tier (e.g. *Tier 1 / Product Ready*).

### Admin Management API
- `GET /api/admin/mentors`: Lists all mentors with 2nd/3rd year mentee counts.
- `POST /api/admin/assign-mentor`: Assigns a list of student roll numbers to a mentor.
- `POST /api/admin/auto-assign-departments`: Automatically distributes students to department mentors.
- `GET /api/admin/student-scores`: Paginated filterable score matrix across all students.
- `GET /api/admin/export-scores`: Streams generated Excel `.xlsx` file.
- `POST /api/admin/email-export`: Sends Excel report via SMTP email.

### Mentor Review API
- `GET /api/mentor/mentees`: Returns students assigned to the authenticated faculty mentor.
- `GET /api/mentor/pending-approvals`: Lists all pending student evidence submissions across the 12 parameters.
- `POST /api/mentor/verify-evidence/:parameter/:id`: Approves (`VERIFIED`) or rejects (`REJECTED`) student evidence.

### 12-Parameter Module APIs
- `GET /api/coding-problems/student/:id`: Returns verified coding problem profiles & total solved counts.
- `POST /api/coding-problems/verify-ownership`: Verifies profile ownership and scrapes LeetCode, CodeChef, CF, HackerRank, GFG, SkillRack.
- `POST /api/cp-rating/sync-from-coding-platforms`: Auto-syncs live contest ratings and calculates single best CP marks.
- `POST /api/open-source/verify-ownership`: Verifies GitHub ownership and calculates PR stage marks.
- `POST /api/open-source/sync`: Re-syncs live PR status from GitHub search API.
- `POST /api/upload`: Handles file upload (PDF/PNG/JPG) for certificate and document proof attachments.

---

## 15. Frontend Architecture & Component Flow

```mermaid
flowchart TD
    MAIN[main.jsx] --> APP[App.jsx]
    APP --> ROUTER[React Router DOM v7]
    ROUTER --> GUARD[ProtectedRoute Component]
    
    GUARD --> LOGIN[Login.jsx]
    GUARD --> DASH[Dashboard.jsx - Student 250M Hub]
    GUARD --> MENTOR[MentorDashboard.jsx - Approval Portal]
    GUARD --> ADMIN[AdminDashboard.jsx - Dean Analytics]
    
    DASH --> MOD_CODING[CodingProblems.jsx]
    DASH --> MOD_CPRATING[CpRating.jsx]
    DASH --> MOD_OSS[OpenSource.jsx]
    DASH --> MOD_HUNDRED[HundredDays.jsx]
    DASH --> MOD_PROJECT[ProjectPubPatent.jsx]
    DASH --> MOD_INTERN[Internship.jsx]
    DASH --> MOD_COMP[Competition.jsx]
    DASH --> MOD_GATE[Gate.jsx]
    DASH --> MOD_LANG[Language.jsx]
    DASH --> MOD_APT[Aptitude.jsx]
    DASH --> MOD_CERT[Certificate.jsx]
    DASH --> MOD_MONTH[MonthlyCoding.jsx]
```

### State Management & Styling
- **Client State**: Built on React 19 native hooks (`useState`, `useEffect`, `useCallback`, `useMemo`).
- **Styling Architecture**: Vanilla CSS design system with CSS custom properties (`--primary`, `--success`, `--surface`, `--text-primary`), smooth transitions, responsive grids, dark/light contrast cards, and loading skeletons.

---

## 16. Backend Architecture

The backend utilizes a **Modular Monolith** architecture with clean separation of concerns:
1. **Routing Layer (`src/routes/*`)**: Express route definitions, request validation (`express-validator`), and HTTP response dispatching.
2. **Business Logic & Scoring Engine**: Automated evaluation engines for 12 academic parameters.
3. **Scraper & Fetcher Adapters (`backend/services/*`)**: Isolated external fetchers handling platform-specific APIs and resilient HTML parsing.
4. **Data Access Layer**: Sequelize ORM utilizing parameterized SQL queries with SQL-injection protection.

---

## 17. Request → Processing → Response Flow

```text
[Browser Client]
       │
       ▼ (1) HTTP POST /api/cp-rating/sync-from-coding-platforms (Bearer JWT)
[Express CORS & Auth Middleware]
       │ (2) Verify JWT signature & decode user claims
       ▼
[cpRatingRoutes.js -> handleSyncRatings]
       │ (3) Query coding_problems_evidence for student's verified handles
       ▼
[ratingFetcher.js]
       │ (4) Concurrently query LeetCode GraphQL, Codeforces API, CodeChef & AtCoder JSON API
       ▼
[calculatePlatformMarks()]
       │ (5) Evaluate rating against threshold tables (e.g. AtCoder 436 >= 400 -> 5 Marks)
       ▼
[PostgreSQL Database]
       │ (6) INSERT/UPDATE scores table (parameter_id = 'cp_rating', marks = 5.00)
       │ (7) UPDATE profiles SET total_score = SUM(scores.marks)
       ▼
[HTTP Response 200 OK]
       │ (8) Return { success: true, marks: 5, best_platform: 'ATCODER', platforms: [...] }
       ▼
[React UI State Update]
```

---

## 18. Security & Anti-Fraud Mechanisms

1. **Anti-Fraud Bio Token Verification**:
   - Students cannot claim another person's GitHub, LeetCode, or CodeChef account.
   - The system generates a cryptographic random token (`VERIFY-<ROLL>-<RANDOM>`).
   - The student must paste this token into their public profile bio or name.
   - The backend scrapes the live public profile and checks for the token before granting `VERIFIED` status.
2. **Password Security**: Passwords hashed with BCrypt (10 rounds).
3. **SQL Injection Protection**: All queries utilize parameterized replacements (`:rollNumber`, `:paramId`).
4. **Role-Based Access Control**: Strict middleware guards separating student, faculty mentor, and admin privileges.
5. **Rate Limiting & Timeout Resiliency**: Outbound HTTP scraper calls utilize 10–15 second timeouts with exponential backoff and fallback parsing.

---

## 19. Configuration & Environment Management

| Variable Name | Purpose | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Backend HTTP Port | `3005` |
| `DATABASE_URL` | PostgreSQL Connection URI | `postgresql://user:pass@host:5432/hope_db` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `[REDACTED]` |
| `NODE_ENV` | Application environment | `production` / `development` |
| `SMTP_HOST` | Outgoing email server | `smtp.hope.edu` |
| `SMTP_PORT` | Outgoing email port | `587` |
| `SMTP_USER` | SMTP authentication user | `[REDACTED]` |
| `SMTP_PASS` | SMTP authentication password | `[REDACTED]` |
| `VITE_API_URL` | Frontend API backend endpoint | `https://hope-backend-psi.vercel.app` |

---

## 20. Complete Dependency Breakdown

- **`express`**: Fast, minimalist web framework for building REST APIs.
- **`sequelize`**: Promise-based Node.js ORM for PostgreSQL.
- **`pg` & `pg-hstore`**: PostgreSQL client and hstore serializer for Node.js.
- **`jsonwebtoken`**: Implementation of JSON Web Tokens for authentication.
- **`bcryptjs`**: Optimized password-hashing library.
- **`axios`**: Promise-based HTTP client for API requests and scraping.
- **`cheerio`**: Fast HTML DOM parser for server-side web scraping.
- **`multer`**: Middleware for handling `multipart/form-data` file uploads.
- **`exceljs`**: Library to read, manipulate and write Excel spreadsheets.
- **`nodemailer`**: Module for sending emails via SMTP.
- **`react` & `react-dom`**: React core library and DOM renderer.
- **`react-router-dom`**: Client routing for React web applications.
- **`vite`**: Frontend build tool and development server.

---

## 21. External Services, APIs & Scraping Adapters

1. **LeetCode**: GraphQL queries to `https://leetcode.com/graphql` for contest rating and total solved problems.
2. **Codeforces**: Official REST API `https://codeforces.com/api/user.info`.
3. **CodeChef**: Profile scraper extracting contest rating and star tier.
4. **AtCoder**: Official JSON History API `https://atcoder.jp/users/{handle}/history/json`.
5. **HackerRank**: REST API `https://www.hackerrank.com/rest/hackers/{handle}/scores_elo`.
6. **GeeksForGeeks**: Scraper extracting problem solved counts and score metrics.
7. **SkillRack**: Parser extracting student solved counts via candidate resume keys.
8. **GitHub API**: REST search API `https://api.github.com/search/issues` and Cheerio profile bio scraper.

---

## 22. Error Handling & Fault Tolerance

- **Global Express Error Handler**: Catches uncaught exceptions and returns standard JSON `{ success: false, error: 'Internal server error' }`.
- **Validation Middleware**: `express-validator` returns structured field errors with HTTP 400.
- **Scraper Fallbacks**: If an external platform API times out or rate limits, the scraper falls back to alternative regex and HTML scrapers without crashing the application.

---

## 23. Data Validation & Sanitization

- **Input Sanitization**: Handles and URLs are trimmed, lowercased, and sanitized.
- **UUID Validation**: Parameter verification routes validate UUID formats (`isUUID()`).
- **Database Constraints**: Foreign keys enforce referential integrity across `students`, `mentors`, `parameters`, and `scores`.

---

## 24. 12-Parameter Business Rules & Scoring Engine

The total academic readiness score is normalized to **250 Marks Max**:

| # | Parameter | DB Parameter ID | Max Marks | Scoring Logic / Rubric |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Coding Problems** | `coding_problems` | **20** | $\ge 2000$ solved: 20M, $\ge 1500$: 18M, $\ge 1000$: 15M, $\ge 500$: 12M, $\ge 300$: 10M, $\ge 150$: 5M, $\ge 50$: 2M. (Plus SQL problems bonus). |
| **2** | **CP Rating** | `cp_rating` | **20** | Single best rating across LeetCode, CF, CC, AtCoder (e.g. AtCoder $\ge 1600$: 20M, $\ge 1200$: 15M, $\ge 800$: 10M, $\ge 400$: 5M). |
| **3** | **Open Source** | `opensource` | **20** | Maintainer/GSoC: 20M, Selected: 17M, $\ge 5$ PRs merged: 15M, $\ge 3$ PRs: 10M, 1 PR merged: 5M, 1 PR submitted: 3M. |
| **4** | **Monthly Coding** | `monthly_coding` | **20** | Top college monthly contest rankers (Rank 1–10: 20M, 11–25: 15M, 26–50: 10M, 51–100: 5M). |
| **5** | **100 Days of Code** | `hundred_days` | **20** | Milestone completion: Day 100: 20M, Day 75: 15M, Day 50: 10M, Day 25: 5M. |
| **6** | **Project / Pub / Patent**| `project` | **25** | Granted Patent: 25M, Published Patent: 20M, Scopus/SCI Paper: 20M, Working Hardware/Software Project: 15M. |
| **7** | **GATE / Placement Exam**| `gate` | **25** | GATE Score $\ge 650$: 25M, $\ge 500$: 20M, $\ge 350$: 15M, Qualified: 10M. |
| **8** | **Competitions / Hackathons**| `competition`| **25** | International Winner: 25M, National Winner: 20M, Finalist: 15M, College Winner: 10M, Participant: 5M. |
| **9** | **Internship & Startup** | `internship` | **25** | Paid Tier-1 Internship / Funded Startup: 25M, Product Internship: 20M, Service/MSME: 15M, Virtual: 5M. |
| **10**| **Foreign Language** | `language` | **25** | Certified Advanced (JLPT N2/N1, CEFR B2/C1, Goethe B2): 25M, Intermediate (JLPT N3, CEFR B1): 18M, Basic (JLPT N5/N4, A1/A2): 10M. |
| **11**| **Aptitude & Comm.** | `aptitude` | **25** | AMCAT / CoCubes / eLitmus Score $\ge 90$th percentile: 25M, $\ge 75$th: 20M, $\ge 60$th: 15M. |
| **12**| **Certifications** | `certificate` | **20** | AWS Solutions Architect / GCP / Azure / CKA: 20M, Associate Cloud: 15M, Fundamentals / Coursera Specialization: 10M. |
| **TOTAL** | **12 Parameters Combined** | — | **250** | Normalized Holistic Placement Readiness Index. |

---

## 25. Complete Feature-by-Feature Flow

1. **Student Live Verification Flow**: Select parameter $\rightarrow$ Link Profile URL $\rightarrow$ Complete Bio Verification $\rightarrow$ Real-time scrape $\rightarrow$ Automatic marks calculation $\rightarrow$ Updated Scorecard.
2. **Mentor Review Flow**: Open Mentor Portal $\rightarrow$ View Department Mentees $\rightarrow$ Inspect Submitted Proofs / Certificates $\rightarrow$ Click Approve / Reject $\rightarrow$ Score sync.
3. **Admin Performance Analytics Flow**: Open Admin Portal $\rightarrow$ Switch between 2nd Year (2029 Batch) & 3rd Year (2028 Batch) $\rightarrow$ Inspect Mentors $\rightarrow$ Export Master Excel Sheet $\rightarrow$ Email Report.

---

## 26. Microservices vs. Modular Monolith Architecture

The HOPE Project implements a **Hybrid Modular Monolith**:
- **Deployment Monolith**: The core Express API server coordinates routing and database transactions as a unified deployable unit.
- **Domain Services**: The scrapers and evaluation logic are partitioned into independent domain packages (`backend/services/*`) with dedicated unit tests and configurations, enabling future extraction into microservices if institutional scaling requires it.

---

## 27. Complete Request Trace Examples

### Live Trace: Auto-Syncing Competitive Programming Ratings
1. Client clicks `Re-sync All Ratings` in `CpRating.jsx`.
2. Browser dispatches `POST /api/cp-rating/sync-from-coding-platforms` with JWT token.
3. Server resolves roll number (`24CS422`) $\rightarrow$ Fetches verified handles (`Santhosh20_L`, `santhosh_l20`, `Santhosh_L20`).
4. Outbound fetchers query LeetCode (1316), CodeChef (1195), Codeforces (850), and AtCoder (436).
5. AtCoder rating 436 triggers Brown tier threshold ($\ge 400 \rightarrow$ 5 Marks).
6. Database updates `cp_rating_evidence` and `scores` table with 5.00 marks.
7. Frontend updates stats card displaying **5 / 20 Calculated Marks** and **436 Rating** on AtCoder badge.

---

## 28. End-to-End Data Transformation Flow

```text
User Form Submission (Profile URL)
        ↓
Regex Handle Extractor (Extract 'Santhosh_L20')
        ↓
Platform API / Scraper (Fetch raw JSON / HTML)
        ↓
Data Normalizer (Extract integer rating = 436)
        ↓
Scoring Engine (Map 436 to Stage 5 Marks)
        ↓
Sequelize Parameterized Query (INSERT INTO scores)
        ↓
Profile Aggregator (SUM marks -> update total_score)
        ↓
JSON Response -> React State -> UI Render
```

---

## 29. Design Rationale

- **Why React 19 & Vite?** Ultra-fast build times, zero-latency Hot Module Replacement, and optimized production chunking.
- **Why PostgreSQL & Sequelize?** Strong referential integrity, ACID compliance, relational constraints between students, mentors, and 12-parameter evidence tables.
- **Why JWT Authentication?** Stateless authentication enabling horizontal scaling on serverless runtimes (Vercel) without session memory bottlenecks.
- **Why Anti-Fraud Bio Tokens?** Prevents students from linking other users' high-ranking competitive programming profiles.

---

## 30. Component & Service Relationship Maps

```text
AdminDashboard.jsx
    ↓ calls
adminAPI (api.js)
    ↓ sends HTTP
adminRoutes.js
    ↓ executes
Sequelize Queries
    ↓ accesses
PostgreSQL (students, mentors, scores, profiles)
```

---

## 31. Class & Module Relationships

```mermaid
classDiagram
    class AdminRoutes {
        +getMentors()
        +assignMentor()
        +exportScores()
        +emailScores()
    }
    class OpenSourceRoutes {
        +verifyOwnership()
        +sync()
        +getStudentEvidence()
    }
    class CPRatingRoutes {
        +syncRatings()
        +getMarks()
    }
    class GitHubFetcher {
        +verifyGitHubOwnership()
        +fetchGitHubOpenSourceStats()
    }
    class RatingFetcher {
        +fetchLeetCodeRating()
        +fetchCodeforcesRating()
        +fetchCodeChefRating()
        +fetchAtCoderRating()
    }

    OpenSourceRoutes --> GitHubFetcher
    CPRatingRoutes --> RatingFetcher
```

---

## 32. Authentication vs. Authorization

- **Authentication**: Verifies *who you are*. Implemented via `POST /api/auth/login`, validating password hashes and issuing signed JWTs.
- **Authorization**: Verifies *what you are allowed to do*. Implemented via `authorize(['mentor', 'admin'])` middleware and `ProtectedRoute` component, preventing students from modifying scores or viewing other students' evidence.

---

## 33. Database Query Execution Flow

1. API Route prepares parameterized replacement object `{ canonicalRoll, finalMarks }`.
2. Sequelize client acquires connection from pool.
3. Query executed over TLS socket against PostgreSQL.
4. Rows returned and connection released back to pool.

---

## 34. Application Startup & Bootstrap Flow

1. Node.js executes `backend/core/src/index.js`.
2. `dotenv.config()` loads environment variables.
3. `sequelize.authenticate()` tests connection to PostgreSQL.
4. Express registers global middlewares and mounts 17 route files.
5. Server starts listening on `PORT 3005`.

---

## 35. Local Build & Development Guide

### Prerequisites
- Node.js `v18+` or `v20+` or `v22+`
- PostgreSQL 15+ database instance

### Backend Startup
```powershell
cd backend/core
npm install
node src/index.js
# Running on http://localhost:3005
```

### Frontend Startup
```powershell
cd frontend-react
npm install
npm run dev
# Running on http://localhost:3000
```

---

## 36. Deployment Architecture

- **Frontend Hosting**: Deployed on Vercel as a Vite static SPA bundle with rewrite rules in `frontend-react/vercel.json`.
- **Backend Hosting**: Deployed on Vercel Serverless Functions via entrypoint `api/index.js` rewriting to root `vercel.json`.
- **Database**: Cloud PostgreSQL database with SSL encryption.

---

## 37. Automated Testing Framework

- Test Suites: Located in `backend/services/*/tests/` (e.g. `cpRating.test.js`, `codingPlatform.test.js`).
- Testing Tools: Jest and Supertest for unit and integration testing.

---

## 38. Logging & Auditing Subsystems

- Standard console logging with structured timestamps and severity tags (`[LOGIN]`, `[INFO]`, `[OPEN_SOURCE]`, `[CP_RATING]`, `[ERROR]`).
- Database timestamps (`submitted_at`, `verified_at`, `calculated_at`) track evidence lifecycle and mentor actions.

---

## 39. Performance, Caching & Scalability Analysis

- **Implemented**: Asynchronous non-blocking I/O, database connection pooling, optimized SQL indexes on `roll_number` and `parameter_id`, frontend static asset compression (Gzip/Brotli).
- **Future Enhancements**: Redis caching for live platform scrapers, Kafka event queue integration for asynchronous background batch fetches.

---

## 40. Complete System Architecture Diagram

```mermaid
flowchart TD
    CLIENT[Vite React 19 Frontend SPA]
    SERVER[Express.js Modular Monolith Core]
    AUTH_MW[JWT Auth & RBAC Middleware]
    ROUTES[Route Modules: 12 Parameters, Admin, Mentor]
    FETCHERS[Web Scrapers & Platform Fetchers]
    DB[(Cloud PostgreSQL Database)]
    
    EXT_GH[GitHub API]
    EXT_LC[LeetCode GraphQL]
    EXT_CF[Codeforces API]
    EXT_CC[CodeChef Scraper]
    EXT_AC[AtCoder JSON API]

    CLIENT -->|REST API over HTTPS| SERVER
    SERVER --> AUTH_MW
    AUTH_MW --> ROUTES
    ROUTES -->|Read / Write| DB
    ROUTES --> FETCHERS
    FETCHERS --> EXT_GH
    FETCHERS --> EXT_LC
    FETCHERS --> EXT_CF
    FETCHERS --> EXT_CC
    FETCHERS --> EXT_AC
```

---

## 41. Complete End-to-End Execution Trace

### Student Linking GitHub & Allotting 15 Marks
1. Student opens **Open Source Contributions** module.
2. Clicks **Verify & Link Account** $\rightarrow$ System generates `VERIFY-24CS422-97YVK`.
3. Student adds token to their GitHub profile bio and saves.
4. Student clicks **Verify & Link Account** on modal.
5. Backend verifies token presence on `https://github.com/Santhosh-L-source`.
6. Backend queries GitHub Search API: discovers 11 submitted PRs and 9 merged PRs.
7. Scoring engine awards **15 / 20 Marks** (Stage: $\ge 5$ merged PRs).
8. Record stored in `open_source_evidence` as `VERIFIED` and `scores` table updated (`parameter_id = 'opensource'`).
9. Total profile score updated in `profiles`.
10. UI displays success toast and updates dashboard score to 15 / 20.

---

## 42. Interview Preparation Guide & Technical Q&A

### 1-Minute Project Summary
> "The HOPE Project is an automated student academic readiness and placement evaluation system tracking students across 12 skill parameters (250 Marks max). It features automated web scraping engines with cryptographic anti-fraud bio verification for LeetCode, CodeChef, Codeforces, AtCoder, and GitHub, empowering students with live score tracking and providing faculty mentors and deans with cohort analytics and automated Excel reporting."

### Technical Interview Questions & Answers

#### Q1: How does the system prevent students from forging their coding platform handles?
**Answer**: We implemented an **Anti-Fraud Bio Token Verification** protocol. When a student links a profile, the backend generates a random token associated with their roll number (`VERIFY-<ROLL>-<TOKEN>`). The student must place this token in their public bio. The backend scrapes the live profile to verify token presence before confirming profile ownership.

#### Q2: Why did you use a Modular Monolith instead of full Microservices?
**Answer**: A modular monolith simplifies deployment and transaction consistency across relational entities while maintaining clean domain boundaries in `backend/services/*`. The scraping engines operate as isolated modules that can be extracted into independent microservices as institutional load increases.

#### Q3: How are AtCoder ratings fetched reliably?
**Answer**: AtCoder's user profile page uses dynamic HTML markup with nested spans. We query AtCoder's official JSON history API endpoint (`https://atcoder.jp/users/{handle}/history/json`) which returns a structured array of contest results, extracting the latest `NewRating` with 100% reliability.

---

## 43. Important Files Quick Reference

| File | Purpose | Key Responsibility |
| :--- | :--- | :--- |
| `backend/core/src/index.js` | Backend Entrypoint | Initializes Express, registers middleware, mounts routes, connects DB. |
| `backend/core/src/config/database.js` | Database Config | Manages Sequelize PostgreSQL connection pooling and SSL. |
| `backend/core/src/middleware/auth.js` | Auth Middleware | JWT validation, bearer token decoding, role-based authorization. |
| `backend/core/src/routes/adminRoutes.js` | Admin Controller | Cohort analytics, mentor assignment, Excel workbook generation. |
| `backend/core/src/routes/openSourceRoutes.js` | Open Source Controller | GitHub bio verification, live PR tracking, stage mark allotting. |
| `backend/core/src/routes/cpRatingRoutes.js` | CP Rating Controller | Aggregates contest ratings across 4 platforms, evaluates single best tier. |
| `backend/services/coding-platform/src/fetchers/ratingFetcher.js` | Rating Fetcher Engine | Outbound API queries for LeetCode, CF, CodeChef, AtCoder. |
| `frontend-react/src/App.jsx` | Client Router | Route declarations, role guards (`ProtectedRoute`), redirection. |
| `frontend-react/src/services/api.js` | Frontend API Client | Central Axios client injecting Bearer JWT headers into requests. |

---

## 44. API Quick Reference Table

| Method | Endpoint | Purpose | Access Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | User authentication | Public |
| `GET` | `/api/auth/me` | Fetch authenticated profile | Any authenticated |
| `GET` | `/api/student/profile/:rollNumber` | Get 12-parameter student scorecard | Student / Mentor / Admin |
| `GET` | `/api/admin/mentors` | Get mentors with cohort mentee counts | Admin |
| `GET` | `/api/admin/student-scores` | Paginated student performance matrix | Admin |
| `GET` | `/api/admin/export-scores` | Download `.xlsx` score workbook | Admin |
| `POST` | `/api/open-source/verify-ownership`| Bio verify & link GitHub account | Student |
| `POST` | `/api/open-source/sync` | Re-sync live GitHub contributions | Student |
| `POST` | `/api/cp-rating/sync-from-coding-platforms` | Re-sync live contest ratings | Student |
| `POST` | `/api/upload` | Upload certificate/evidence files | Student / Mentor |

---

## 45. Database Tables Quick Reference

| Table Name | Purpose | Primary Key | Key Relationships |
| :--- | :--- | :--- | :--- |
| `students` | Student directory & metadata | `roll_number` | `mentor_roll_number -> mentors.roll_number` |
| `mentors` | Faculty mentor directory | `roll_number` | Manages students |
| `administrators`| Admin credentials | `roll_number` | System governance |
| `parameters` | 12 academic parameters definition | `id` | Defines max marks (20 or 25) |
| `scores` | Calculated marks per parameter | `id` (UUID) | `roll_number -> students`, `parameter_id -> parameters` |
| `profiles` | Aggregated student readiness scores | `roll_number` | `roll_number -> students` |
| `open_source_evidence` | GitHub PR evidence records | `id` (UUID) | `roll_number -> students` |
| `cp_rating_evidence` | Platform rating evidence records | `id` (UUID) | `roll_number -> students` |
| `coding_problems_evidence`| Solved problems evidence records | `id` (UUID) | `roll_number -> students` |

---

## 46. Final Project Flow Diagram

```text
========================================================================================
                                HOPE PROJECT FLOW
========================================================================================

    [STUDENT / MENTOR / ADMIN]
                │
                ▼
    [React 19 Frontend UI (Vite + React Router v7)]
                │
                ▼ (HTTP REST Requests with Bearer JWT Token)
    [Express.js Modular Monolith Core (Node.js)]
                │
        ┌───────┴───────────────────────────────┐
        ▼                                       ▼
  [JWT Auth Middleware]               [Platform Scrapers & Fetchers]
   - Token signature check             - LeetCode GraphQL
   - Role authorization check          - Codeforces REST API
        │                              - CodeChef Scraper
        ▼                              - AtCoder JSON History API
  [12-Parameter Evaluation Engine]     - GitHub Search & Cheerio Bio Verifier
   - Stage scoring (250 Marks Max)              │
   - Single-best rating engine                  ▼
        │                              [External Coding Platforms]
        ▼
  [Sequelize ORM & Query Builder]
        │
        ▼ (Parameterized SQL over TLS)
  [Cloud PostgreSQL Database (Neon / AWS / Supabase)]
   - students, mentors, administrators
   - parameters, scores, profiles
   - 12 parameter evidence tables
        │
        ▼
  [Aggregated Real-Time Performance & Placement Readiness Response]
========================================================================================
```
