// Firebase configuration
// TODO: Replace these values with actual Firebase config from Firebase Console
// Go to: Firebase Console → Project Settings → Your apps → Web app
const firebaseConfig = {
  apiKey: "YOUR_WEB_API_KEY_FROM_FIREBASE_CONSOLE",
  authDomain: "agent-drugs.firebaseapp.com",
  projectId: "agent-drugs",
  storageBucket: "agent-drugs.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_WEB_APP_ID"
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

// Sign in handlers
googleSignInBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error('Google sign-in error:', error);
    showError('Failed to sign in with Google. Please try again.');
  }
});

githubSignInBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GithubAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error('GitHub sign-in error:', error);
    showError('Failed to sign in with GitHub. Please try again.');
  }
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
