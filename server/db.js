const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_DATABASE || 'finanzafacil',
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const query = async (sql, params) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

const getConnection = () => pool.getConnection();

module.exports = { pool, query, getConnection };
