try { require('dotenv').config(); } catch (e) {}
const { Sequelize } = require('sequelize');
const pg = require('pg');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    dialectModule: pg,
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
      statement_timeout: 30000, // 30 seconds per statement
    },
  }
);

module.exports = sequelize;
