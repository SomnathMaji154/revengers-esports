const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect((err) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err.message);
  } else {
    console.log('Connected to PostgreSQL database.');
    initializeDatabase();
  }
});

async function initializeDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      jerseyNumber INTEGER NOT NULL,
      imageUrl TEXT,
      stars INTEGER DEFAULT 0,
      joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS managers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(255) NOT NULL,
      imageUrl TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS trophies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      year INTEGER NOT NULL,
      imageUrl TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS contact_submissions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      whatsapp VARCHAR(255) NOT NULL,
      submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR(255) PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP NOT NULL
    );`
  ];

  for (const sql of tables) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.error('Error creating table:', err.message);
    }
  }

  // Migrate existing data - remove imageData if it exists
  try {
    await pool.query('ALTER TABLE IF EXISTS players DROP COLUMN IF EXISTS imageData');
    await pool.query('ALTER TABLE IF EXISTS managers DROP COLUMN IF EXISTS imageData');
    await pool.query('ALTER TABLE IF EXISTS trophies DROP COLUMN IF EXISTS imageData');
    console.log('Database schema migrated successfully');
  } catch (err) {
    console.log('Schema migration skipped (columns may not exist):', err.message);
  }

  // Create default admin if not exists
  const defaultAdmin = { username: 'admin', password: 'adminpassword' };
  try {
    const res = await pool.query('SELECT * FROM admins WHERE username = $1', [defaultAdmin.username]);
    if (res.rows.length === 0) {
      const hash = await bcrypt.hash(defaultAdmin.password, 10);
      await pool.query('INSERT INTO admins (username, password) VALUES ($1, $2)', [defaultAdmin.username, hash]);
      console.log('Default admin created: username=admin, password=adminpassword');
    }
  } catch (err) {
    console.error('Error creating default admin:', err.message);
  }

  console.log('Database initialized. Tables ready.');
}

// Helper functions to match existing API (callback-based for compatibility)
module.exports = {
  all: (sql, params = [], callback) => {
    pool.query(sql, params, (err, res) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, res.rows);
      }
    });
  },
  get: (sql, params = [], callback) => {
    pool.query(sql, params, (err, res) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, res.rows[0] || null);
      }
    });
  },
  run: (sql, params = [], callback) => {
    // Check if it's an INSERT statement and add RETURNING id if it's not there
    if (sql.trim().toUpperCase().startsWith('INSERT') && !/RETURNING \*/i.test(sql) && !/RETURNING id/i.test(sql)) {
      sql = sql.trim();
      const semicolon = sql.endsWith(';') ? ';' : '';
      if (semicolon) {
        sql = sql.slice(0, -1);
      }
      sql = `${sql} RETURNING id${semicolon}`;
    }

    pool.query(sql, params, (err, res) => {
      if (err) {
        return callback(err);
      }
      // lastID is specific to insert, for update/delete, changes is more relevant
      const lastID = (res.rows && res.rows.length > 0 && res.rows[0].id) ? res.rows[0].id : null;
      const changes = res.rowCount;
      callback(null, { lastID, changes });
    });
  },
  close: (callback) => {
    pool.end((err) => {
      if (err) {
        callback(err);
      } else {
        callback(null);
      }
    });
  }
};
