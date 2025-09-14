// Jest Global Setup
// Runs once before all tests

module.exports = async () => {
  console.log('🧪 Setting up test environment...');
  
  // Set global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret-for-jest';
  process.env.PORT = '3001';
  
  // Enable mock mode
  global.MOCK_MODE = true;
  
  // Initialize test database or mocks
  try {
    // If you have a test database setup, initialize it here
    console.log('📊 Test database initialized');
  } catch (error) {
    console.log('⚠️  Using mock mode for database');
  }
  
  console.log('✅ Test environment ready');
};