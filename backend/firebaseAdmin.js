const admin = require('firebase-admin');

// Firebase Service Account Key (from environment variable for security)
// IMPORTANT: This should be set as a single JSON string environment variable on Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Firebase Project Configuration (from your Firebase console)
const firebaseConfig = {
  apiKey: "AIzaSyC1IamXYFqErTrisuPVJILXr7tTEXaZzC4",
  authDomain: "revengersesportsbackend.firebaseapp.com",
  projectId: "revengersesportsbackend",
  storageBucket: "revengersesportsbackend.appspot.com",
  messagingSenderId: "798141417235",
  appId: "1:798141417235:web:9ce2ae9d7fd01a5357fce6",
  measurementId: "G-6WKL33Z41X"
};

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: firebaseConfig.storageBucket
});

const bucket = admin.storage().bucket();

module.exports = { bucket };
