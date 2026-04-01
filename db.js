const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fuelfinder',
  password: 'Owethuwarona@2010',
  port: 5432,
});

module.exports = pool;