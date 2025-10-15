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
const signInCtaBtn = document.getElementById('sign-in-cta');
const previewOauthBtn = document.getElementById('preview-oauth');
const signOutBtn = document.getElementById('sign-out');
const agentsList = document.getElementById('agents-list');

// Show message (error or success)
function showMessage(message, isError = true) {
  errorMessage.textContent = message;
  errorMessage.className = isError
    ? 'px-4 py-3 bg-red-100 border border-red-400 text-red-700 rounded-lg'
    : 'px-4 py-3 bg-green-100 border border-green-400 text-green-700 rounded-lg';
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
      agentsList.innerHTML = `
        <div class="text-center py-12 px-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p class="text-2xl mb-3">🤖 No agents authorized yet</p>
          <p class="text-gray-600">Run <code class="px-2 py-1 bg-gray-200 rounded text-primary font-mono text-sm">claude plugin install agent-drugs</code> to authorize your first agent!</p>
        </div>
      `;
      return;
    }

    let html = '<div class="space-y-4">';
    snapshot.forEach(doc => {
      const data = doc.data();
      const daysLeft = daysUntilExpiration(data.createdAt);
      const isExpired = daysLeft === 0;

      let statusBadge;
      if (isExpired) {
        statusBadge = '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">⚠️ Expired</span>';
      } else if (daysLeft <= 7) {
        statusBadge = `<span class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">⏰ ${daysLeft} days left</span>`;
      } else {
        statusBadge = `<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">✅ Active (${daysLeft} days)</span>`;
      }

      const opacity = isExpired ? 'opacity-60' : '';

      html += `
        <div class="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow ${opacity}">
          <div class="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
            <h4 class="text-lg font-bold">${escapeHtml(data.name)}</h4>
            ${statusBadge}
          </div>
          <div class="p-4 space-y-3">
            <div class="flex justify-between text-sm">
              <span class="font-semibold text-gray-600">Client ID</span>
              <span class="text-gray-900 font-mono text-xs">${escapeHtml(data.clientId || 'N/A')}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="font-semibold text-gray-600">Created</span>
              <span class="text-gray-900">${formatTimestamp(data.createdAt)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="font-semibold text-gray-600">Last Used</span>
              <span class="text-gray-900">${formatTimestamp(data.lastUsedAt)}</span>
            </div>
          </div>
          <div class="p-4 bg-gray-50 border-t border-gray-200">
            <button class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors" onclick="revokeAgent('${doc.id}', '${escapeHtml(data.name)}')">
              Revoke Access
            </button>
          </div>
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
  if (!confirm(`Revoke access for "${agentName}"?\n\nThis will invalidate its bearer token and the agent will need to re-authorize.`)) {
    return;
  }

  try {
    await db.collection('agents').doc(agentId).delete();
    showMessage(`Access revoked for ${agentName}`, false);

    // Reload agents list
    const user = auth.currentUser;
    if (user) {
      await loadAgents(user.uid);
    }
  } catch (error) {
    console.error('Error revoking agent:', error);
    showMessage('Failed to revoke access. Please try again.', true);
  }
};

// Sign in for CTA
if (signInCtaBtn) {
  signInCtaBtn.addEventListener('click', async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (error) {
      console.error('Sign-in error:', error);
      showMessage('Failed to sign in. Please try again.', true);
    }
  });
}

// Preview OAuth flow (optional button)
if (previewOauthBtn) {
  previewOauthBtn.addEventListener('click', async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (error) {
      console.error('Sign-in error:', error);
      showMessage('Failed to sign in. Please try again.', true);
    }
  });
}

// Auth state observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // User is signed in - show dashboard
    welcomeSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    await loadAgents(user.uid);
  } else {
    // User is not signed in - show welcome
    welcomeSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
  }
});

// Sign out
if (signOutBtn) {
  signOutBtn.addEventListener('click', () => {
    auth.signOut();
  });
}
