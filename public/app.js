// Firebase configuration (will be filled in next task)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "agent-drugs.firebaseapp.com",
  projectId: "agent-drugs",
  storageBucket: "agent-drugs.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements
const loginSection = document.getElementById('login-section');
const keySection = document.getElementById('key-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const googleSignInBtn = document.getElementById('google-signin');
const githubSignInBtn = document.getElementById('github-signin');
const signOutBtn = document.getElementById('sign-out');
const copyKeyBtn = document.getElementById('copy-key');
const apiKeyDisplay = document.getElementById('api-key');
const keyInConfig = document.getElementById('key-in-config');

// Show error
function showError(message) {
  errorMessage.textContent = message;
  errorSection.classList.remove('hidden');
  setTimeout(() => {
    errorSection.classList.add('hidden');
  }, 5000);
}

// Auth state observer (placeholder for next task)
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User logged in:', user.uid);
    // Will implement key generation in next task
  } else {
    loginSection.classList.remove('hidden');
    keySection.classList.add('hidden');
  }
});

// Sign in handlers (placeholder)
googleSignInBtn.addEventListener('click', () => {
  console.log('Google sign-in clicked');
});

githubSignInBtn.addEventListener('click', () => {
  console.log('GitHub sign-in clicked');
});

signOutBtn.addEventListener('click', () => {
  auth.signOut();
});

copyKeyBtn.addEventListener('click', () => {
  const keyText = apiKeyDisplay.textContent;
  navigator.clipboard.writeText(keyText).then(() => {
    copyKeyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyKeyBtn.textContent = 'Copy';
    }, 2000);
  });
});
