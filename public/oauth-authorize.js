// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwf77Zt6V-aF6okTQxYM8h8ymFXiUOsD8",
  authDomain: "agent-drugs.firebaseapp.com",
  projectId: "agent-drugs",
  storageBucket: "agent-drugs.firebasestorage.app",
  messagingSenderId: "456573964043",
  appId: "1:456573964043:web:d5ab6852606e78b93c5c0e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const functions = firebase.functions();
const db = firebase.firestore();

// DOM elements
const loadingSection = document.getElementById('loading-section');
const loginSection = document.getElementById('login-section');
const authorizeSection = document.getElementById('authorize-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const clientName = document.getElementById('client-name');
const clientNameAuth = document.getElementById('client-name-auth');
const agentNameInput = document.getElementById('agent-name');
const googleSignInBtn = document.getElementById('google-signin');
const githubSignInBtn = document.getElementById('github-signin');
const authorizeBtn = document.getElementById('authorize-btn');
const denyBtn = document.getElementById('deny-btn');
const agentSelect = document.getElementById('agent-select');
const agentsLoading = document.getElementById('agents-loading');
const existingAgentsList = document.getElementById('existing-agents-list');
const newAgentSection = document.getElementById('new-agent-section');

// Parse OAuth parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const oauthParams = {
  client_id: urlParams.get('client_id'),
  redirect_uri: urlParams.get('redirect_uri'),
  response_type: urlParams.get('response_type'),
  scope: urlParams.get('scope'),
  state: urlParams.get('state'),
  code_challenge: urlParams.get('code_challenge'),
  code_challenge_method: urlParams.get('code_challenge_method')
};

// Show error
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.className = 'px-4 py-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center';
  errorSection.classList.remove('hidden');
  loadingSection.classList.add('hidden');
  loginSection.classList.add('hidden');
  authorizeSection.classList.add('hidden');
}

// Validate OAuth parameters
function validateOAuthParams() {
  if (!oauthParams.client_id) {
    showError('Missing required parameter: client_id');
    return false;
  }
  if (!oauthParams.redirect_uri) {
    showError('Missing required parameter: redirect_uri');
    return false;
  }
  if (oauthParams.response_type !== 'code') {
    showError('Invalid response_type. Only "code" is supported.');
    return false;
  }
  if (!oauthParams.code_challenge) {
    showError('Missing required parameter: code_challenge (PKCE required)');
    return false;
  }
  if (oauthParams.code_challenge_method !== 'S256') {
    showError('Invalid code_challenge_method. Only "S256" is supported.');
    return false;
  }
  return true;
}

// Initialize page
function initializePage() {
  if (!validateOAuthParams()) {
    return;
  }

  // Display client name
  const displayName = oauthParams.client_id || 'An application';
  clientName.textContent = displayName;
  clientNameAuth.textContent = displayName;

  // Check auth state
  loadingSection.classList.remove('hidden');
}

// Fetch existing agents for the authenticated user
async function loadExistingAgents(userId) {
  try {
    const snapshot = await db.collection('agents')
      .where('userId', '==', userId)
      .orderBy('lastUsedAt', 'desc')
      .get();

    const agents = [];
    snapshot.forEach(doc => {
      agents.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Populate dropdown
    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = `${agent.name} (last used: ${formatDate(agent.lastUsedAt)})`;
      agentSelect.appendChild(option);
    });

    // Show the dropdown, hide loading
    agentsLoading.classList.add('hidden');
    existingAgentsList.classList.remove('hidden');

    // If no existing agents, select "new" by default
    if (agents.length === 0) {
      agentSelect.value = 'new';
      newAgentSection.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading agents:', error);
    // If we can't load agents, just show the new agent input
    agentsLoading.classList.add('hidden');
    newAgentSection.classList.remove('hidden');
  }
}

// Format timestamp for display
function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return 'unknown';
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

// Handle agent selection change
function handleAgentSelection() {
  const selectedValue = agentSelect.value;
  if (selectedValue === 'new') {
    newAgentSection.classList.remove('hidden');
  } else {
    newAgentSection.classList.add('hidden');
  }
}

// Handle user authorization
async function handleAuthorize() {
  try {
    authorizeBtn.disabled = true;
    authorizeBtn.textContent = 'Authorizing...';

    const selectedAgentId = agentSelect.value === 'new' ? null : agentSelect.value;
    const agentName = selectedAgentId ? undefined : (agentNameInput.value.trim() || undefined);

    // Call Cloud Function to complete OAuth flow
    const oauthCallbackFn = functions.httpsCallable('oauthCallback');
    const result = await oauthCallbackFn({
      clientId: oauthParams.client_id,
      redirectUri: oauthParams.redirect_uri,
      scope: oauthParams.scope,
      state: oauthParams.state,
      codeChallenge: oauthParams.code_challenge,
      codeChallengeMethod: oauthParams.code_challenge_method,
      existingAgentId: selectedAgentId,
      agentName: agentName
    });

    const { authorizationCode, redirectUri, state } = result.data;

    // Redirect back to client with authorization code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', authorizationCode);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    window.location.href = redirectUrl.toString();
  } catch (error) {
    console.error('Authorization error:', error);
    showError('Failed to complete authorization. Please try again.');
    authorizeBtn.disabled = false;
    authorizeBtn.textContent = 'Authorize';
  }
}

// Handle user denial
function handleDeny() {
  const redirectUrl = new URL(oauthParams.redirect_uri);
  redirectUrl.searchParams.set('error', 'access_denied');
  redirectUrl.searchParams.set('error_description', 'User denied authorization');
  if (oauthParams.state) {
    redirectUrl.searchParams.set('state', oauthParams.state);
  }
  window.location.href = redirectUrl.toString();
}

// Auth state observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // User is signed in, load their agents and show authorization
    loadingSection.classList.add('hidden');
    loginSection.classList.add('hidden');
    authorizeSection.classList.remove('hidden');

    // Load existing agents
    await loadExistingAgents(user.uid);
  } else {
    // User is not signed in, show login
    loadingSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    authorizeSection.classList.add('hidden');
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

// Agent selection handler
agentSelect.addEventListener('change', handleAgentSelection);

// Authorization buttons
authorizeBtn.addEventListener('click', handleAuthorize);
denyBtn.addEventListener('click', handleDeny);

// Initialize on page load
initializePage();
