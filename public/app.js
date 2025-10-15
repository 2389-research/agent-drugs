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
const db = firebase.firestore();

// DOM elements
const welcomeSection = document.getElementById('welcome-section');
const dashboardSection = document.getElementById('dashboard-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const signInPreviewBtn = document.getElementById('sign-in-preview');
const signOutBtn = document.getElementById('sign-out');
const agentsList = document.getElementById('agents-list');

// Show error
function showError(message) {
  errorMessage.textContent = message;
  errorSection.classList.remove('hidden');
  setTimeout(() => {
    errorSection.classList.add('hidden');
  }, 5000);
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Never';
  const date = timestamp.toDate();
  return date.toLocaleString();
}

// Calculate days until expiration
function daysUntilExpiration(createdAt) {
  if (!createdAt) return null;
  const created = createdAt.toMillis();
  const now = Date.now();
  const ageInDays = (now - created) / (1000 * 60 * 60 * 24);
  const remaining = 90 - ageInDays;
  return Math.max(0, Math.floor(remaining));
}

// Load user's agents
async function loadAgents(userId) {
  try {
    const snapshot = await db.collection('agents')
      .where('userId', '==', userId)
      .orderBy('lastUsedAt', 'desc')
      .get();

    if (snapshot.empty) {
      agentsList.innerHTML = '<p>No agents authorized yet. Connect Claude Code with the OAuth config above to authorize your first agent!</p>';
      return;
    }

    let html = '<div class="agents-grid">';
    snapshot.forEach(doc => {
      const data = doc.data();
      const daysLeft = daysUntilExpiration(data.createdAt);
      const isExpired = daysLeft === 0;
      const expirationText = isExpired
        ? '<span class="expired">Expired - Re-authorize</span>'
        : `<span class="expires">${daysLeft} days until expiration</span>`;

      html += `
        <div class="agent-card ${isExpired ? 'expired-card' : ''}">
          <h4>${escapeHtml(data.name)}</h4>
          <p><strong>Client ID:</strong> ${escapeHtml(data.clientId || 'N/A')}</p>
          <p><strong>Created:</strong> ${formatTimestamp(data.createdAt)}</p>
          <p><strong>Last Used:</strong> ${formatTimestamp(data.lastUsedAt)}</p>
          <p class="expiration-info">${expirationText}</p>
          <button class="btn btn-danger btn-small" onclick="revokeAgent('${doc.id}', '${escapeHtml(data.name)}')">Revoke Access</button>
        </div>
      `;
    });
    html += '</div>';
    agentsList.innerHTML = html;
  } catch (error) {
    console.error('Error loading agents:', error);
    agentsList.innerHTML = '<p class="error">Failed to load agents</p>';
  }
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Revoke agent access
window.revokeAgent = async function(agentId, agentName) {
  if (!confirm(`Revoke access for "${agentName}"? This will invalidate its bearer token and the agent will need to re-authorize.`)) {
    return;
  }

  try {
    await db.collection('agents').doc(agentId).delete();
    showSuccess(`Access revoked for ${agentName}`);

    // Reload agents list
    const user = auth.currentUser;
    if (user) {
      await loadAgents(user.uid);
    }
  } catch (error) {
    console.error('Error revoking agent:', error);
    showError('Failed to revoke access. Please try again.');
  }
};

// Show success message
function showSuccess(message) {
  errorMessage.textContent = message;
  errorMessage.style.color = 'green';
  errorSection.classList.remove('hidden');
  setTimeout(() => {
    errorSection.classList.add('hidden');
    errorMessage.style.color = '';
  }, 3000);
}

// Sign in for preview
signInPreviewBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error('Sign-in error:', error);
    showError('Failed to sign in. Please try again.');
  }
});

// Auth state observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // User is signed in
    welcomeSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    await loadAgents(user.uid);
  } else {
    // User is not signed in
    welcomeSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
  }
});

// Sign out
signOutBtn.addEventListener('click', () => {
  auth.signOut();
});
