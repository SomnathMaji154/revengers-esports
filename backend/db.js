const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database configuration with fallbacks
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/revengers_esports',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 500,
  idleTimeoutMillis: 30000,
  max: 10
};

const pool = new Pool(dbConfig);

// Mock data storage for when database is not available
let mockData = {
  players: [],
  managers: [],
  trophies: [],
  contact_submissions: [],
  admins: []
};

// Add default admin for mock mode
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  const defaultAdmin = { username: 'admin', password: process.env.DEFAULT_ADMIN_PASSWORD || 'adminpassword' };
  mockData.admins.push({
    id: 1,
    username: defaultAdmin.username,
    password: defaultAdmin.password // In real implementation, this would be hashed
  });
  console.log('Mock admin created:', mockData.admins[0]);
}

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.warn('Warning: Could not connect to PostgreSQL database. Running in mock mode.');
    console.warn('For full functionality, please configure DATABASE_URL environment variable.');
    // Database operations will be mocked
    global.MOCK_MODE = true;
  } else {
    console.log('Connected to PostgreSQL database.');
    initializeDatabase();
    global.MOCK_MODE = false;
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

  // Add indexes for performance
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_players_joined_date ON players (joined_date)`,
    `CREATE INDEX IF NOT EXISTS idx_trophies_year ON trophies (year)`,
    `CREATE INDEX IF NOT EXISTS idx_contact_submissions_date ON contact_submissions (submission_date)`,
    `CREATE INDEX IF NOT EXISTS idx_admins_username ON admins (username)`
  ];

  for (const sql of indexes) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.error('Error creating index:', err.message);
    }
  }

  console.log('Database indexes created successfully');

  // Create default admin if not exists (only in development)
  if (process.env.NODE_ENV === 'development') {
    const defaultAdmin = { username: 'admin', password: process.env.DEFAULT_ADMIN_PASSWORD || 'adminpassword' };
    try {
      const res = await pool.query('SELECT * FROM admins WHERE username = $1', [defaultAdmin.username]);
      if (res.rows.length === 0) {
        const hash = await bcrypt.hash(defaultAdmin.password, 10);
        await pool.query('INSERT INTO admins (username, password) VALUES ($1, $2)', [defaultAdmin.username, hash]);
      }
    } catch (err) {
      console.error('Error creating default admin:', err.message);
    }
 }

  console.log('Database initialized. Tables ready.');
}

// Helper functions to match existing API (callback-based for compatibility)
module.exports = {
  all: (sql, params = [], callback) => {
    if (global.MOCK_MODE) {
      // Mock implementation for SELECT queries
      const table = sql.match(/FROM\s+(\w+)/i);
      if (table) {
        const tableName = table[1];
        if (mockData[tableName]) {
          callback(null, mockData[tableName]);
        } else {
          callback(null, []);
        }
      } else {
        callback(null, []);
      }
    } else {
      pool.query(sql, params, (err, res) => {
        if (err) {
          callback(err, null);
        } else {
          callback(null, res.rows);
        }
      });
    }
  },
  get: (sql, params = [], callback) => {
    if (global.MOCK_MODE) {
      // Mock implementation for single row SELECT queries
      const table = sql.match(/FROM\s+(\w+)/i);
      if (table) {
        const tableName = table[1];
        if (mockData[tableName]) {
          // Find matching record by username parameter
          if (params.length > 0 && tableName === 'admins') {
            const username = params[0];
            const admin = mockData[tableName].find(a => a.username === username);
            callback(null, admin || null);
          } else if (mockData[tableName].length > 0) {
            callback(null, mockData[tableName][0]);
          } else {
            callback(null, null);
          }
        } else {
          callback(null, null);
        }
      } else {
        callback(null, null);
      }
    } else {
      pool.query(sql, params, (err, res) => {
        if (err) {
          callback(err, null);
        } else {
          callback(null, res.rows[0] || null);
        }
      });
    }
  },
  run: (sql, params = [], callback) => {
    if (global.MOCK_MODE) {
      // Mock implementation for INSERT/UPDATE/DELETE queries
      try {
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          const table = sql.match(/INTO\s+(\w+)/i);
          if (table) {
            const tableName = table[1];
            if (mockData[tableName]) {
              const newId = mockData[tableName].length + 1;
              // For contact submissions, add the data
              if (tableName === 'contact_submissions') {
                const [name, email, whatsapp] = params;
                mockData[tableName].push({
                  id: newId,
                  name: name,
                  email: email,
                  whatsapp: whatsapp,
                  submission_date: new Date().toISOString()
                });
              }
              callback(null, { lastID: newId, changes: 1 });
            } else {
              callback(null, { lastID: 1, changes: 1 });
            }
          } else {
            callback(null, { lastID: 1, changes: 1 });
          }
        } else {
          callback(null, { lastID: null, changes: 1 });
        }
      } catch (err) {
        callback(err);
      }
    } else {
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
    }
  },
  close: (callback) => {
    if (global.MOCK_MODE) {
      callback(null);
    } else {
      pool.end((err) => {
        if (err) {
          callback(err);
        } else {
          callback(null);
        }
      });
    }
  }
};
