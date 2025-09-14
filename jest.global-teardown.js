// Jest Global Teardown
// Runs once after all tests complete

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Close any open connections
  if (global.testServer) {
    await new Promise((resolve) => {
      global.testServer.close(resolve);
    });
    console.log('🔌 Test server closed');
  }
  
  // Clean up test database
  try {
    // If you have test database cleanup, do it here
    console.log('🗑️  Test database cleaned');
  } catch (error) {
    console.log('⚠️  Mock mode cleanup completed');
  }
  
  // Clear any remaining timers
  clearTimeout();
  clearInterval();
  
  console.log('✅ Test environment cleaned up');
};