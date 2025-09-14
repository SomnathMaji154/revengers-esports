// Admin Management Script
// Run this script to create additional admin users

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAdmin(username, password) {
  try {
    // Check if admin already exists
    const existingAdmin = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (existingAdmin.rows.length > 0) {
      console.log(`Admin '${username}' already exists`);
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create admin
    const result = await pool.query(
      'INSERT INTO admins (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    
    console.log(`Admin created successfully:`, result.rows[0]);
  } catch (error) {
    console.error('Error creating admin:', error.message);
  }
}

async function deleteAdmin(username) {
  try {
    const result = await pool.query('DELETE FROM admins WHERE username = $1 RETURNING username', [username]);
    if (result.rows.length > 0) {
      console.log(`Admin '${username}' deleted successfully`);
    } else {
      console.log(`Admin '${username}' not found`);
    }
  } catch (error) {
    console.error('Error deleting admin:', error.message);
  }
}

async function listAdmins() {
  try {
    const result = await pool.query('SELECT id, username, created_at, last_login FROM admins ORDER BY created_at');
    console.log('Current admins:');
    console.table(result.rows);
  } catch (error) {
    console.error('Error listing admins:', error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'create':
      if (args.length < 3) {
        console.log('Usage: node admin-manager.js create <username> <password>');
        return;
      }
      await createAdmin(args[1], args[2]);
      break;
      
    case 'delete':
      if (args.length < 2) {
        console.log('Usage: node admin-manager.js delete <username>');
        return;
      }
      await deleteAdmin(args[1]);
      break;
      
    case 'list':
      await listAdmins();
      break;
      
    default:
      console.log('Available commands:');
      console.log('  create <username> <password> - Create new admin');
      console.log('  delete <username>           - Delete admin');
      console.log('  list                        - List all admins');
  }
  
  await pool.end();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createAdmin, deleteAdmin, listAdmins };