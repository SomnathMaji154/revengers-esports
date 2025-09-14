const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const config = require('./config');
const logger = require('./logger');

// Database configuration
const dbConfig = {
  connectionString: config.DATABASE_URL,
  ...config.dbPoolConfig
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
if (config.isDevelopment && config.defaultAdmin) {
  mockData.admins.push({
    id: 1,
    username: config.defaultAdmin.username,
    password: config.defaultAdmin.password // In real implementation, this would be hashed
  });
  logger.debug('Mock admin created', { username: config.defaultAdmin.username });
}

// Test database connection with better error handling
let connectionRetries = 0;
const maxRetries = 3;

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as now, version() as version');
    logger.info('Connected to PostgreSQL database', {
      timestamp: result.rows[0].now,
      version: result.rows[0].version.split(' ')[0]
    });
    global.MOCK_MODE = false;
    await initializeDatabase();
  } catch (err) {
    connectionRetries++;
    logger.error('Database connection failed', {
      attempt: connectionRetries,
      maxRetries,
      error: err.message
    });
    
    if (connectionRetries < maxRetries) {
      logger.info('Retrying database connection', { delay: '2 seconds' });
      setTimeout(testConnection, 2000);
    } else {
      logger.warn('Max connection retries reached. Running in mock mode', {
        warning: 'For full functionality, please configure DATABASE_URL environment variable'
      });
      global.MOCK_MODE = true;
    }
  }
}

testConnection();

async function initializeDatabase() {
  logger.info('Initializing database schema...');
  
  const tables = [
    {
      name: 'admins',
      sql: `CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )`
    },
    {
      name: 'players',
      sql: `CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        jerseyNumber INTEGER NOT NULL UNIQUE,
        imageUrl TEXT,
        stars INTEGER DEFAULT 0 CHECK (stars >= 1 AND stars <= 5),
        joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'managers',
      sql: `CREATE TABLE IF NOT EXISTS managers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        imageUrl TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'trophies',
      sql: `CREATE TABLE IF NOT EXISTS trophies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM NOW()) + 1),
        imageUrl TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'contact_submissions',
      sql: `CREATE TABLE IF NOT EXISTS contact_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(255) NOT NULL,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT
      )`
    },
    {
      name: 'sessions',
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP NOT NULL
      )`
    }
  ];

  for (const table of tables) {
    try {
      await pool.query(table.sql);
      logger.debug('Table created/verified', { table: table.name });
    } catch (err) {
      logger.error('Error creating table', { table: table.name, error: err.message });
      throw err;
    }
  }

  // Migrate existing data - remove imageData if it exists
  try {
    const migrations = [
      'ALTER TABLE IF EXISTS players DROP COLUMN IF EXISTS imageData',
      'ALTER TABLE IF EXISTS managers DROP COLUMN IF EXISTS imageData',
      'ALTER TABLE IF EXISTS trophies DROP COLUMN IF EXISTS imageData',
      'ALTER TABLE IF EXISTS players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE IF EXISTS managers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE IF EXISTS managers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE IF EXISTS trophies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE IF EXISTS trophies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE IF EXISTS admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE IF EXISTS admins ADD COLUMN IF NOT EXISTS last_login TIMESTAMP',
      'ALTER TABLE IF EXISTS contact_submissions ADD COLUMN IF NOT EXISTS ip_address INET',
      'ALTER TABLE IF EXISTS contact_submissions ADD COLUMN IF NOT EXISTS user_agent TEXT'
    ];
    
    for (const migration of migrations) {
      await pool.query(migration);
    }
    logger.info('Database schema migrated successfully');
  } catch (err) {
    logger.debug('Schema migration completed with warnings', { message: err.message });
  }

  // Add indexes for performance
  const indexes = [
    {
      name: 'idx_players_jersey_unique',
      sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_players_jersey_unique ON players (jerseyNumber)'
    },
    {
      name: 'idx_players_joined_date',
      sql: 'CREATE INDEX IF NOT EXISTS idx_players_joined_date ON players (joined_date DESC)'
    },
    {
      name: 'idx_trophies_year',
      sql: 'CREATE INDEX IF NOT EXISTS idx_trophies_year ON trophies (year DESC)'
    },
    {
      name: 'idx_contact_submissions_date',
      sql: 'CREATE INDEX IF NOT EXISTS idx_contact_submissions_date ON contact_submissions (submission_date DESC)'
    },
    {
      name: 'idx_admins_username',
      sql: 'CREATE INDEX IF NOT EXISTS idx_admins_username ON admins (username)'
    },
    {
      name: 'idx_contact_email',
      sql: 'CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions (email)'
    },
    {
      name: 'idx_sessions_expire',
      sql: 'CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire)'
    }
  ];

  for (const index of indexes) {
    try {
      await pool.query(index.sql);
      logger.debug('Index created/verified', { index: index.name });
    } catch (err) {
      logger.warn('Index creation warning', { index: index.name, error: err.message });
    }
  }

  logger.info('Database indexes created successfully');

  // Create default admin if not exists (only in development)
  if (config.isDevelopment && config.defaultAdmin) {
    try {
      const res = await pool.query('SELECT * FROM admins WHERE username = $1', [config.defaultAdmin.username]);
      if (res.rows.length === 0) {
        const hash = await bcrypt.hash(config.defaultAdmin.password, config.BCRYPT_ROUNDS);
        await pool.query('INSERT INTO admins (username, password) VALUES ($1, $2)', [config.defaultAdmin.username, hash]);
        logger.info('Default admin created', { username: config.defaultAdmin.username });
      } else {
        logger.debug('Default admin already exists', { username: config.defaultAdmin.username });
      }
    } catch (err) {
      logger.error('Error creating default admin', { error: err.message });
    }
  }

  logger.info('Database initialized successfully');
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
