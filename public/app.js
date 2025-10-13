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

// Generate random API key
function generateApiKey() {
  const prefix = 'agdrug_';
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 32;
  let key = prefix;

  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    key += charset[randomValues[i] % charset.length];
  }

  return key;
}

// Get or create API key for user
async function getOrCreateApiKey(userId) {
  try {
    // Query for existing key
    const snapshot = await db.collection('api_keys')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      // Return existing key
      return snapshot.docs[0].data().key;
    }

    // Generate new key
    const newKey = generateApiKey();
    await db.collection('api_keys').add({
      key: newKey,
      userId: userId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return newKey;
  } catch (error) {
    console.error('Error getting/creating API key:', error);
    throw error;
  }
}

// Auth state observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    loginSection.classList.add('hidden');
    keySection.classList.remove('hidden');

    try {
      // Get or create API key
      const apiKey = await getOrCreateApiKey(user.uid);

      // Display key
      apiKeyDisplay.textContent = apiKey;
      keyInConfig.textContent = apiKey;
    } catch (error) {
      console.error('Error loading API key:', error);
      showError('Failed to load API key. Please refresh the page.');
    }
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
