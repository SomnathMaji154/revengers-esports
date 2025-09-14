module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Coverage collection
  collectCoverageFrom: [
    'backend/**/*.js',
    'scripts/**/*.js',
    '!backend/node_modules/**',
    '!backend/coverage/**',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30
    }
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  
  // Module paths
  moduleDirectories: [
    'node_modules',
    '<rootDir>'
  ],
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Transform configuration
  // transform: {
  //   '^.+\\\\.js$': 'babel-jest'
  // },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/optimized/',
    '/.build-temp/'
  ],
  
  // Reporters
  reporters: [
    'default'
  ],
  
  // Global setup
  globalSetup: '<rootDir>/jest.global-setup.js',
  globalTeardown: '<rootDir>/jest.global-teardown.js',
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Force exit
  forceExit: true,
  
  // Maximum worker pool
  maxWorkers: '50%'

};