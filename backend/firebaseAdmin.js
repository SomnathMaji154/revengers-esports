const admin = require('firebase-admin');

// Firebase Service Account Key (from environment variable for security)
// IMPORTANT: This should be set as a single JSON string environment variable on Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Use the project ID to construct the actual GCS bucket name for API calls
  storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
});

const bucket = admin.storage().bucket();

// Export firebaseConfig for CSP in server.js
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

module.exports = { bucket, firebaseConfig };
