const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcryptjs = require('bcryptjs');
const fs = require('fs');

const dbPath = path.join(__dirname, 'revengers.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    jerseyNumber INTEGER,
    imageUrl TEXT,
    stars INTEGER,
    joined_date DATETIME DEFAULT (DATETIME('now'))
  )`, (err) => {
    if (err) console.error('Error creating players table:', err.message);
    else console.log('Players table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    imageUrl TEXT
  )`, (err) => {
    if (err) console.error('Error creating managers table:', err.message);
    else console.log('Managers table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS trophies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    year INTEGER,
    imageUrl TEXT
  )`, (err) => {
    if (err) console.error('Error creating trophies table:', err.message);
    else console.log('Trophies table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    submission_date DATETIME DEFAULT (DATETIME('now'))
  )`, (err) => {
    if (err) console.error('Error creating contact_submissions table:', err.message);
    else console.log('Contact submissions table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`, (err) => {
    if (err) console.error('Error creating admins table:', err.message);
    else {
      console.log('Admins table ready');
      db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
          bcryptjs.hash('adminpassword', 10, (err, hash) => {
            if (err) console.error('Error hashing admin password:', err.message);
            else {
              db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hash], (err) => {
                if (err) console.error('Error inserting default admin:', err.message);
                else console.log('Default admin user created');
              });
            }
          });
        }
      });
    }
  });

  console.log('Database initialized. Tables are empty and ready for admin data entry.');
});

// Close database on app exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});

module.exports = db;
