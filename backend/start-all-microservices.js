/**
 * HOPE PROJECT - Microservices Multi-Process Runner
 * 
 * Spawns each of the 12 backend microservices on its allocated port:
 * - 3000: coding-platform
 * - 3001: cp-rating
 * - 3002: open-source
 * - 3003: competition
 * - 3004: internship-startup
 * - 3005: project-pub-patent / Core API Gateway
 * - 3006: foreign-language
 * - 3007: gate-exam
 * - 3008: monthly-coding
 * - 3009: 100days
 * - 3010: aptitude-comm
 * - 3011: certificate-achievement
 */

const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'Coding Platform', dir: 'coding-platform', port: 3000, cmd: 'node', args: ['src/index.js'] },
  { name: 'CP Rating', dir: 'cp-rating', port: 3001, cmd: 'node', args: ['src/index.js'] },
  { name: 'Open Source', dir: 'open-source', port: 3002, cmd: 'node', args: ['src/index.js'] },
  { name: 'Competition', dir: 'competition', port: 3003, cmd: 'node', args: ['src/index.js'] },
  { name: 'Internship / Startup', dir: 'internship-startup', port: 3004, cmd: 'node', args: ['src/index.js'] },
  { name: 'Core API Gateway', dir: '../core', port: 3005, cmd: 'node', args: ['src/index.js'] },
  { name: 'Foreign Language', dir: 'foreign-language', port: 3006, cmd: 'node', args: ['src/app.js'] },
  { name: 'GATE / Exam', dir: 'gate-exam', port: 3007, cmd: 'node', args: ['src/app.js'] },
  { name: 'Monthly Coding Assessment', dir: 'monthly-coding', port: 3008, cmd: 'node', args: ['src/index.js'] },
  { name: '100 Days Training', dir: '100days', port: 3009, cmd: 'node', args: ['src/index.js'] },
  { name: 'Aptitude & Communication', dir: 'aptitude-comm', port: 3010, cmd: 'node', args: ['src/index.js'] },
  { name: 'Certificate Achievement', dir: 'certificate-achievement', port: 3011, cmd: 'node', args: ['src/index.js'] },
];

console.log('================================================================');
console.log('       HOPE PROJECT - Initializing 12 Backend Microservices     ');
console.log('================================================================\n');

const runningProcesses = [];

services.forEach((service) => {
  const serviceCwd = path.resolve(__dirname, 'services', service.dir);
  console.log(`[🚀 STARTING] ${service.name.padEnd(28)} | Port: ${service.port} | Path: ${service.dir}`);

  const proc = spawn(service.cmd, service.args, {
    cwd: serviceCwd,
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, PORT: service.port }
  });

  proc.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`[${service.name}] ${text}`);
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text && !text.includes('ExperimentalWarning')) {
      console.error(`[${service.name} ERR] ${text}`);
    }
  });

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`[${service.name}] Exited with code ${code}`);
    }
  });

  runningProcesses.push(proc);
});

process.on('SIGINT', () => {
  console.log('\n[🛑 STOPPING] Terminating all microservices gracefully...');
  runningProcesses.forEach((p) => p.kill());
  process.exit();
});
