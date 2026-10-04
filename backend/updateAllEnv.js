const fs = require('fs');
const path = require('path');

const servicesDir = 'c:\\Users\\victus\\OneDrive\\Attachments\\OneDrive\\Desktop\\HOPE_PROJECT\\backend\\services';
const newDbConfig = {
  DB_HOST: 'aws-0-ap-northeast-1.pooler.supabase.com',
  DB_PORT: '5432',
  DB_NAME: 'postgres',
  DB_USER: 'postgres.ctxwkofvaaghougcuyap',
  DB_PASSWORD: '@15095780Santhosh'
};

const serviceDirs = fs.readdirSync(servicesDir);
for (const s of serviceDirs) {
  const fullPath = path.join(servicesDir, s);
  if (fs.statSync(fullPath).isDirectory()) {
    const envPath = path.join(fullPath, '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
      content = content.replace(/DB_HOST=.*/g, `DB_HOST=${newDbConfig.DB_HOST}`);
      content = content.replace(/DB_PORT=.*/g, `DB_PORT=${newDbConfig.DB_PORT}`);
      content = content.replace(/DB_NAME=.*/g, `DB_NAME=${newDbConfig.DB_NAME}`);
      content = content.replace(/DB_USER=.*/g, `DB_USER=${newDbConfig.DB_USER}`);
      content = content.replace(/DB_PASSWORD=.*/g, `DB_PASSWORD=${newDbConfig.DB_PASSWORD}`);
    } else {
      content = `PORT=3000\nDB_DIALECT=postgres\nDB_HOST=${newDbConfig.DB_HOST}\nDB_PORT=${newDbConfig.DB_PORT}\nDB_NAME=${newDbConfig.DB_NAME}\nDB_USER=${newDbConfig.DB_USER}\nDB_PASSWORD=${newDbConfig.DB_PASSWORD}\nJWT_SECRET=hope-project-jwt-secret-key-2024\n`;
    }
    fs.writeFileSync(envPath, content);
    console.log(`Updated .env in service: ${s}`);
  }
}
