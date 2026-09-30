# HOPE Project - React Frontend

Modern React application for HOPE Project Achievement Tracker.

## Tech Stack
- React 18 + Vite
- React Router DOM
- Vanilla CSS
- Fetch API

## Quick Start

### Install
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
Opens at http://localhost:3000

### Build Production
```bash
npm run build
```

## Project Structure
```
src/
├── components/       # Header, ProtectedRoute
├── pages/           # Login, Dashboard, Modules
├── services/        # API layer (api.js)
├── utils/           # Auth helpers
└── App.jsx          # Routing setup
```

## Backend Connection
- API Base: http://localhost:3005
- Auth: JWT in localStorage

## Test Credentials
Username: 24CS360
Password: 312324104001

## Features
✅ Login/Logout with JWT
✅ Protected routes
✅ Dashboard with 7 modules
✅ Competition module (fully functional)
✅ Real-time marks fetching
🚧 Other 6 module pages (use Competition.jsx as template)

## Development
- No CSS frameworks (vanilla CSS)
- Component-scoped styling
- React hooks for state
- Vite for fast dev/build
