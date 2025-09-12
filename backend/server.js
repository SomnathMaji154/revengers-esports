const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer'); // For handling file uploads
const sharp = require('sharp'); // For image processing

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../'))); // Serve frontend files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded images

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'backend/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Session middleware
app.use(session({
  secret: 'your_secret_key', // Replace with a strong secret in production
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Database
const dbPath = path.join(__dirname, 'revengers.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    position TEXT,
    ovr INTEGER,
    jerseyNumber INTEGER,
    imageUrl TEXT,
    stars INTEGER,
    chemistryLinks INTEGER,
    experience INTEGER,
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
      // Insert a default admin if none exists
      db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
          bcrypt.hash('adminpassword', 10, (err, hash) => {
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

  // Insert sample data if tables are empty
  db.get("SELECT COUNT(*) as count FROM players", (err, row) => {
    if (err) {
      console.error(err.message);
      return;
    }
    if (row.count === 0) {
      const samplePlayers = [
        { name: 'Kai Jensen', email: 'kai@revengers.com', position: 'ST', ovr: 89, jerseyNumber: 7, imageUrl: 'https://images.unsplash.com/photo-1571019613454-9e9192ea696e?w=300&h=400&fit=crop', stars: 5, chemistryLinks: 2, experience: 5 },
        { name: 'Lena Vogt', email: 'lena@revengers.com', position: 'LW', ovr: 84, jerseyNumber: 11, imageUrl: 'https://images.unsplash.com/photo-1607744986526-7f44e5377b2f?w=300&h=400&fit=crop', stars: 4, chemistryLinks: 2, experience: 3 },
        { name: 'Theo Grant', email: 'theo@revengers.com', position: 'CM', ovr: 91, jerseyNumber: 6, imageUrl: 'https://images.unsplash.com/photo-1611003229180-b1087d8ce7b5?w=300&h=400&fit=crop', stars: 5, chemistryLinks: 2, experience: 7 },
        { name: 'Nora Kim', email: 'nora@revengers.com', position: 'CB', ovr: 78, jerseyNumber: 4, imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=300&h=400&fit=crop', stars: 3, chemistryLinks: 2, experience: 2 },
        { name: 'Raul Ortiz', email: 'raul@revengers.com', position: 'GK', ovr: 82, jerseyNumber: 1, imageUrl: 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c6b?w=300&h=400&fit=crop', stars: 4, chemistryLinks: 2, experience: 4 }
      ];

      const stmt = db.prepare('INSERT INTO players (name, email, position, ovr, jerseyNumber, imageUrl, stars, chemistryLinks, experience) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      samplePlayers.forEach(p => stmt.run(p.name, p.email, p.position, p.ovr, p.jerseyNumber, p.imageUrl, p.stars, p.chemistryLinks, p.experience));
      stmt.finalize(err => {
        if (err) console.error('Error inserting sample players:', err.message);
        else console.log('Sample players inserted');
      });
    }
  });

  db.get("SELECT COUNT(*) as count FROM managers", (err, row) => {
    if (err) return console.error(err.message);
    if (row.count === 0) {
      const sampleManagers = [
        { name: 'Alex Ferguson', role: 'Head Coach', imageUrl: 'https://images.unsplash.com/photo-1571019613454-9e9192ea696e?w=300&h=400&fit=crop' },
        { name: 'Jane Smith', role: 'Assistant Coach', imageUrl: 'https://images.unsplash.com/photo-1607744986526-7f44e5377b2f?w=300&h=400&fit=crop' }
      ];
      const stmt = db.prepare('INSERT INTO managers (name, role, imageUrl) VALUES (?, ?, ?)');
      sampleManagers.forEach(m => stmt.run(m.name, m.role, m.imageUrl));
      stmt.finalize(err => {
        if (err) console.error('Error inserting sample managers:', err.message);
        else console.log('Sample managers inserted');
      });
    }
  });

  db.get("SELECT COUNT(*) as count FROM trophies", (err, row) => {
    if (err) return console.error(err.message);
    if (row.count === 0) {
      const sampleTrophies = [
        { name: 'Esports Championship', year: 2023, imageUrl: 'https://images.unsplash.com/photo-1571019613454-9e9192ea696e?w=300&h=400&fit=crop' },
        { name: 'Regional Cup', year: 2024, imageUrl: 'https://images.unsplash.com/photo-1607744986526-7f44e5377b2f?w=300&h=400&fit=crop' }
      ];
      const stmt = db.prepare('INSERT INTO trophies (name, year, imageUrl) VALUES (?, ?, ?)');
      sampleTrophies.forEach(t => stmt.run(t.name, t.year, t.imageUrl));
      stmt.finalize(err => {
        if (err) console.error('Error inserting sample trophies:', err.message);
        else console.log('Sample trophies inserted');
      });
    }
  });
});

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

// API Routes

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM admins WHERE username = ?', [username], async (err, admin) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!admin) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }
    const match = await bcrypt.compare(password, admin.password);
    if (match) {
      req.session.isAdmin = true;
      res.json({ message: 'Logged in successfully' });
    } else {
      res.status(400).json({ message: 'Invalid credentials' });
    }
  });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.status(500).json({ error: 'Could not log out' });
      return;
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Admin Status (check if logged in)
app.get('/api/admin/status', (req, res) => {
  res.json({ loggedIn: req.session.isAdmin || false });
});

// GET /api/players - Fetch all players
app.get('/api/players', (req, res) => {
  db.all("SELECT * FROM players ORDER BY joined_date DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

// POST /api/players - Add new player (handles both join page and admin)
app.post('/api/players', isAuthenticated, upload.single('image'), async (req, res) => { // Protected route
  const { name, email, position, ovr, jerseyNumber, stars, experience } = req.body;
  let imageUrl = null;

  if (req.file) {
    const filename = `player-${Date.now()}.webp`;
    const outputPath = path.join(__dirname, 'uploads', filename);
    try {
      await sharp(req.file.buffer)
        .resize(300, 400, { // Standard size for player cards
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
      imageUrl = `/uploads/${filename}`;
    } catch (error) {
      console.error('Error processing player image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  }

  const sql = `INSERT INTO players (name, email, position, ovr, jerseyNumber, imageUrl, stars, experience, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [name, email, position, ovr, jerseyNumber, imageUrl, stars, experience, 'active'];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Player added successfully' });
  });
});

// PUT /api/players/:id/image - Update player image
app.put('/api/players/:id/image', isAuthenticated, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let imageUrl = null;

  if (req.file) {
    const filename = `player-${Date.now()}.webp`;
    const outputPath = path.join(__dirname, 'uploads', filename);
    try {
      await sharp(req.file.buffer)
        .resize(300, 400, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
      imageUrl = `/uploads/${filename}`;
    } catch (error) {
      console.error('Error processing player image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  db.run('UPDATE players SET imageUrl = ? WHERE id = ?', [imageUrl, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ message: 'Player image updated successfully', imageUrl: imageUrl });
  });
});

// DELETE /api/players/:id - Delete any player (admin)
app.delete('/api/players/:id', isAuthenticated, (req, res) => { // Protected route
  const { id } = req.params;
  db.run("DELETE FROM players WHERE id = ?", [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ message: 'Player deleted successfully' });
  });
});

// --- Manager Routes ---
app.get('/api/managers', (req, res) => {
  db.all("SELECT * FROM managers", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

app.post('/api/managers', isAuthenticated, upload.single('image'), async (req, res) => { // Protected route
  const { name, role } = req.body;
  let imageUrl = null;

  if (req.file) {
    const filename = `manager-${Date.now()}.webp`;
    const outputPath = path.join(__dirname, 'uploads', filename);
    try {
      await sharp(req.file.buffer)
        .resize(300, 400, { // Standard size for manager cards
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
      imageUrl = `/uploads/${filename}`;
    } catch (error) {
      console.error('Error processing manager image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  }

  db.run('INSERT INTO managers (name, role, imageUrl) VALUES (?, ?, ?)', [name, role, imageUrl], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Manager added successfully' });
  });
});

// PUT /api/managers/:id/image - Update manager image
app.put('/api/managers/:id/image', isAuthenticated, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let imageUrl = null;

  if (req.file) {
    const filename = `manager-${Date.now()}.webp`;
    const outputPath = path.join(__dirname, 'uploads', filename);
    try {
      await sharp(req.file.buffer)
        .resize(300, 400, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
      imageUrl = `/uploads/${filename}`;
    } catch (error) {
      console.error('Error processing manager image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  db.run('UPDATE managers SET imageUrl = ? WHERE id = ?', [imageUrl, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Manager not found' });
    }
    res.json({ message: 'Manager image updated successfully', imageUrl: imageUrl });
  });
});

app.delete('/api/managers/:id', isAuthenticated, (req, res) => { // Protected route
  db.run("DELETE FROM managers WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json({ message: 'Manager deleted successfully' });
  });
});

// --- Trophy Routes ---
app.get('/api/trophies', (req, res) => {
  db.all("SELECT * FROM trophies", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

app.post('/api/trophies', isAuthenticated, upload.single('image'), async (req, res) => { // Protected route
  const { name, year } = req.body;
  let imageUrl = null;

  if (req.file) {
    const filename = `trophy-${Date.now()}.webp`;
    const outputPath = path.join(__dirname, 'uploads', filename);
    try {
      await sharp(req.file.buffer)
        .resize(400, 300, { // Standard size for trophies (landscape)
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
      imageUrl = `/uploads/${filename}`;
    } catch (error) {
      console.error('Error processing trophy image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  }

  db.run('INSERT INTO trophies (name, year, imageUrl) VALUES (?, ?, ?)', [name, year, imageUrl], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Trophy added successfully' });
  });
});

// PUT /api/trophies/:id/image - Update trophy image
app.put('/api/trophies/:id/image', isAuthenticated, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  let imageUrl = null;

  if (req.file) {
    const filename = `trophy-${Date.now()}.webp`;
    const outputPath = path.join(__dirname, 'uploads', filename);
    try {
      await sharp(req.file.buffer)
        .resize(400, 300, {
          fit: sharp.fit.cover,
          position: sharp.strategy.entropy
        })
        .webp({ quality: 80 })
        .toFile(outputPath);
      imageUrl = `/uploads/${filename}`;
    } catch (error) {
      console.error('Error processing trophy image:', error);
      return res.status(500).json({ error: 'Error processing image' });
    }
  } else {
    return res.status(400).json({ error: 'No image file provided' });
  }

  db.run('UPDATE trophies SET imageUrl = ? WHERE id = ?', [imageUrl, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Trophy not found' });
    }
    res.json({ message: 'Trophy image updated successfully', imageUrl: imageUrl });
  });
});

app.delete('/api/trophies/:id', isAuthenticated, (req, res) => { // Protected route
  db.run("DELETE FROM trophies WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json({ message: 'Trophy deleted successfully' });
  });
});

// --- Contact Form Routes ---
app.post('/api/contact', (req, res) => {
  const { name, email, whatsapp } = req.body;
  const sql = `INSERT INTO contact_submissions (name, email, whatsapp) VALUES (?, ?, ?)`;
  const params = [name, email, whatsapp];

  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.status(201).json({ id: this.lastID, message: 'Contact submission received successfully' });
  });
});

app.get('/api/registered-users', isAuthenticated, (req, res) => { // Protected route
  db.all("SELECT name, email, whatsapp FROM contact_submissions ORDER BY submission_date DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return console.error(err.message);
    }
    res.json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
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
