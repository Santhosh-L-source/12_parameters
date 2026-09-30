require('dotenv').config();
const sequelize = require('./src/config/database');

async function checkParameters() {
  try {
    const [params] = await sequelize.query('SELECT id, name, max_marks FROM parameters ORDER BY max_marks DESC, id ASC');
    console.log('=== PARAMETERS TABLE ===');
    console.table(params);

    const [sumRes] = await sequelize.query('SELECT SUM(max_marks) as total_sum FROM parameters');
    console.log('=== SUM OF MAX MARKS ===');
    console.log(sumRes[0]);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkParameters();
