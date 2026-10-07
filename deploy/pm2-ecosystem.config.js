// PM2 Ecosystem Configuration for HOPE Project
// This file manages all 13 services (1 gateway + 12 microservices)

module.exports = {
  apps: [
    // API Gateway (Port 3005) - Central entry point
    {
      name: 'hope-gateway',
      script: './backend/core/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      error_file: './logs/gateway-error.log',
      out_file: './logs/gateway-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // Microservice 1: Coding Platform (Port 3000)
    {
      name: 'service-coding-platform',
      script: './backend/services/coding-platform/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },

    // Microservice 2: CP Rating (Port 3001)
    {
      name: 'service-cp-rating',
      script: './backend/services/cp-rating/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },

    // Microservice 3: Open Source (Port 3002)
    {
      name: 'service-open-source',
      script: './backend/services/open-source/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },

    // Microservice 4: Competition (Port 3003)
    {
      name: 'service-competition',
      script: './backend/services/competition/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
    },

    // Microservice 5: Internship/Startup (Port 3004)
    {
      name: 'service-internship',
      script: './backend/services/internship-startup/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
      },
    },

    // Microservice 6: Project/Pub/Patent (Port 3005) - CONFLICT! Change to 3015
    {
      name: 'service-project-pub-patent',
      script: './backend/services/project-pub-patent/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3015,  // Changed to avoid conflict with gateway
      },
    },

    // Microservice 7: Foreign Language (Port 3006)
    {
      name: 'service-language',
      script: './backend/services/foreign-language/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
      },
    },

    // Microservice 8: GATE Exam (Port 3007)
    {
      name: 'service-gate',
      script: './backend/services/gate-exam/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
      },
    },

    // Microservice 9: Monthly Coding (Port 3008)
    {
      name: 'service-monthly-coding',
      script: './backend/services/monthly-coding/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3008,
      },
    },

    // Microservice 10: 100 Days (Port 3009)
    {
      name: 'service-100days',
      script: './backend/services/100days/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3009,
      },
    },

    // Microservice 11: Aptitude/Communication (Port 3010)
    {
      name: 'service-aptitude',
      script: './backend/services/aptitude-comm/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },

    // Microservice 12: Certificate Achievement (Port 3011)
    {
      name: 'service-certificate',
      script: './backend/services/certificate-achievement/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
      },
    },
  ],
};
