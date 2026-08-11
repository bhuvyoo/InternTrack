const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'Interntrack',
  password: 'root',
  port: 5432,
});

pool.on('connect', () => {
    console.log('Connected to the database');
});

pool.on('error', (err) => {
    console.error('PostgreSQL error:', err);
}); 

module.exports = pool;