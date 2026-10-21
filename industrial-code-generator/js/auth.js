/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - FIREBASE AUTHENTICATION & WHITELIST
 * Features:
 *   - Firebase Web SDK Authentication (Google 1-Click & Email/Password)
 *   - Strict Email Whitelist Security (Unauthorized accounts are rejected)
 *   - Persistent Login State (Local Storage)
 *   - Modern Industrial Glassmorphic Lock Screen
 *   - Local Developer / Preview Fallback Mode
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};
LabelApp.Auth = {};

// --------------------------------------------------------------------------
// ENVIRONMENT CONFIGURATION: LOADED FROM js/env.js (or .env via build-env.js)
// --------------------------------------------------------------------------
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

window.WHITELISTED_EMAILS = window.WHITELISTED_EMAILS || [];

// Current Auth State & Rate Limiting (Brute Force Protection)
LabelApp.Auth.state = {
  isConfigured: false,
  currentUser: null,
  isBypassed: false
};

LabelApp.Auth.RATE_LIMIT = {
  maxAttempts: 5,                   // Maximum 5 consecutive failed attempts
  lockoutDurationMs: 15 * 60 * 1000 // 15 minutes lockout freeze
};

LabelApp.Auth.lockoutTimer = null;

/**
 * Check if the terminal is currently locked down due to rate limiting
 */
LabelApp.Auth.isLockedOut = function() {
  const lockoutUntil = parseInt(localStorage.getItem('terminal_lockout_until') || '0', 10);
  if (lockoutUntil && Date.now() < lockoutUntil) {
    LabelApp.Auth.applyLockoutUI(lockoutUntil);
    return true;
  }
  if (lockoutUntil && Date.now() >= lockoutUntil) {
    LabelApp.Auth.clearLockout();
  }
  return false;
};

/**
 * Freeze login controls and render active security countdown
 */
LabelApp.Auth.applyLockoutUI = function(lockoutUntil) {
  const btnGoogle = document.getElementById('btnGoogleAuth');
  const btnSubmit = document.querySelector('#authOverlay button[type="submit"]');
  const emailInput = document.getElementById('authEmailInput');
  const passInput = document.getElementById('authPassInput');

  if (btnGoogle) {
    btnGoogle.disabled = true;
    btnGoogle.style.opacity = '0.5';
    btnGoogle.style.pointerEvents = 'none';
  }
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.style.opacity = '0.7';
  }
  if (emailInput) emailInput.disabled = true;
  if (passInput) passInput.disabled = true;

  if (LabelApp.Auth.lockoutTimer) clearInterval(LabelApp.Auth.lockoutTimer);

  const updateCountdown = () => {
    const diff = lockoutUntil - Date.now();
    if (diff <= 0) {
      LabelApp.Auth.clearLockout();
      return;
    }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const timeStr = `${mins}m ${String(secs).padStart(2, '0')}s`;

    if (btnSubmit) btnSubmit.textContent = `🔒 Terminal Frozen (${timeStr})`;
    LabelApp.Auth.showStatus(
      `🚨 Security Lockdown: 5 failed attempts reached. Terminal access is frozen for ${timeStr} to prevent brute-force attacks.`,
      'error'
    );
  };

  updateCountdown();
  LabelApp.Auth.lockoutTimer = setInterval(updateCountdown, 1000);
};

/**
 * Clear lockout state and re-enable login inputs
 */
LabelApp.Auth.clearLockout = function() {
  if (LabelApp.Auth.lockoutTimer) {
    clearInterval(LabelApp.Auth.lockoutTimer);
    LabelApp.Auth.lockoutTimer = null;
  }
  localStorage.removeItem('terminal_lockout_until');
  localStorage.removeItem('terminal_failed_attempts');

  const btnGoogle = document.getElementById('btnGoogleAuth');
  const btnSubmit = document.querySelector('#authOverlay button[type="submit"]');
  const emailInput = document.getElementById('authEmailInput');
  const passInput = document.getElementById('authPassInput');

  if (btnGoogle) {
    btnGoogle.disabled = false;
    btnGoogle.style.opacity = '1';
    btnGoogle.style.pointerEvents = 'auto';
  }
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';
    btnSubmit.textContent = 'Sign In';
  }
  if (emailInput) emailInput.disabled = false;
  if (passInput) passInput.disabled = false;

  LabelApp.Auth.clearStatus();
};

/**
 * Record a failed login or unauthorized access attempt
 */
LabelApp.Auth.recordFailedAttempt = function(reason) {
  let attempts = parseInt(localStorage.getItem('terminal_failed_attempts') || '0', 10) + 1;
  localStorage.setItem('terminal_failed_attempts', String(attempts));

  if (attempts >= LabelApp.Auth.RATE_LIMIT.maxAttempts) {
    const lockoutUntil = Date.now() + LabelApp.Auth.RATE_LIMIT.lockoutDurationMs;
    localStorage.setItem('terminal_lockout_until', String(lockoutUntil));
    LabelApp.Auth.applyLockoutUI(lockoutUntil);
  } else {
    const remaining = LabelApp.Auth.RATE_LIMIT.maxAttempts - attempts;
    LabelApp.Auth.showStatus(
      `${reason || 'Invalid credentials.'} (Security Warning: ${remaining} attempt${remaining > 1 ? 's' : ''} remaining before 15-minute terminal lockdown)`,
      'error'
    );
  }
};

/**
 * Reset failed attempts upon successful authorized authentication
 */
LabelApp.Auth.resetFailedAttempts = function() {
  localStorage.removeItem('terminal_failed_attempts');
  localStorage.removeItem('terminal_lockout_until');
  if (LabelApp.Auth.lockoutTimer) {
    clearInterval(LabelApp.Auth.lockoutTimer);
    LabelApp.Auth.lockoutTimer = null;
  }
};

/**
 * Initialize Firebase and Authentication Listeners
 */
LabelApp.Auth.init = function() {
  // Check rate limit state first
  if (LabelApp.Auth.isLockedOut()) return;

  const cfg = window.FIREBASE_CONFIG;
  const isPlaceholder = !cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY' || cfg.apiKey.includes('YOUR_');

  const banner = document.getElementById('authConfigBanner');
  const lockCard = document.getElementById('authCard');
  const wrap = document.querySelector('.wrap');

  if (isPlaceholder) {
    LabelApp.Auth.state.isConfigured = false;
    if (banner) banner.style.display = 'block';
    console.warn('[LabelApp.Auth] Firebase is not yet configured. Please supply your API keys in js/auth.js.');
    return;
  }

  if (banner) banner.style.display = 'none';
  LabelApp.Auth.state.isConfigured = true;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }

    // Set local persistence so user doesn't need to log in repeatedly
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Real-time auth state listener
    firebase.auth().onAuthStateChanged((user) => {
      LabelApp.Auth.handleAuthState(user);
    });
  } catch (err) {
    console.error('[LabelApp.Auth] Initialization error:', err);
    LabelApp.Auth.showStatus('Firebase initialization error: ' + err.message, 'error');
  }
};

/**
 * Handle Auth State changes (Login, Logout, Whitelist Verification)
 */
LabelApp.Auth.handleAuthState = async function(user) {
  const overlay = document.getElementById('authOverlay');
  const wrap = document.querySelector('.wrap');
  const userPill = document.getElementById('authEmailDisplay');
  const statusBar = document.getElementById('authStatusBar');

  if (!user) {
    // Logged out
    LabelApp.Auth.state.currentUser = null;
    if (wrap) {
      wrap.classList.add('app-locked');
    }
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.classList.remove('fade-out');
    }
    if (statusBar) statusBar.style.display = 'none';
    LabelApp.Auth.clearStatus();
    return;
  }

  // Check Whitelist Security
  const email = (user.email || '').toLowerCase().trim();
  const whitelist = (window.WHITELISTED_EMAILS || []).map(e => (e || '').toLowerCase().trim()).filter(Boolean);

  if (whitelist.length > 0 && !whitelist.includes(email)) {
    // ACCESS DENIED: Account is NOT authorized!
    console.warn(`[LabelApp.Auth] Unauthorized access attempt by: ${email}. Automatically purging user from database...`);
    try {
      // Instantly delete the unauthorized account from Firebase Authentication database
      await user.delete();
    } catch (delErr) {
      console.warn('[LabelApp.Auth] Account purge fallback to sign out:', delErr);
      await firebase.auth().signOut();
    }
    LabelApp.Auth.recordFailedAttempt(`Unauthorized account "${email}". Access denied and purged.`);
    return;
  }

  // ACCESS GRANTED: Reset failed counter
  LabelApp.Auth.resetFailedAttempts();
  LabelApp.Auth.state.currentUser = user;
  if (userPill) {
    userPill.textContent = user.email || 'Authorized Operator';
  }
  if (statusBar) {
    statusBar.style.display = 'flex';
  }

  LabelApp.Auth.showStatus(`✅ Welcome, ${user.displayName || user.email}! Unlocking terminal...`, 'success');

  setTimeout(() => {
    if (overlay) {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 350);
    }
    if (wrap) {
      wrap.classList.remove('app-locked');
    }
    LabelApp.Auth.clearStatus();
  }, 400);
};

/**
 * Sign in with Google (1-Click)
 */
LabelApp.Auth.loginWithGoogle = async function() {
  if (LabelApp.Auth.isLockedOut()) return;

  if (!LabelApp.Auth.state.isConfigured) {
    LabelApp.Auth.showStatus('Please configure Firebase in js/auth.js first.', 'error');
    return;
  }

  LabelApp.Auth.showStatus('Connecting to Google Authentication...', 'info');

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    const email = (user && user.email || '').toLowerCase().trim();
    const whitelist = (window.WHITELISTED_EMAILS || []).map(e => (e || '').toLowerCase().trim()).filter(Boolean);

    if (whitelist.length > 0 && !whitelist.includes(email)) {
      try {
        await user.delete();
      } catch (e) {
        await firebase.auth().signOut();
      }
      LabelApp.Auth.recordFailedAttempt(`Unauthorized account "${email}". Access denied and purged.`);
    } else {
      LabelApp.Auth.resetFailedAttempts();
    }
  } catch (err) {
    console.error('[LabelApp.Auth] Google Login Error:', err);
    if (err.code !== 'auth/popup-closed-by-user') {
      LabelApp.Auth.recordFailedAttempt(LabelApp.Auth.formatErrorMessage(err));
    } else {
      LabelApp.Auth.showStatus(LabelApp.Auth.formatErrorMessage(err), 'error');
    }
  }
};

/**
 * Sign in with Email & Password
 */
LabelApp.Auth.loginWithEmail = async function() {
  if (LabelApp.Auth.isLockedOut()) return;

  if (!LabelApp.Auth.state.isConfigured) {
    LabelApp.Auth.showStatus('Please configure Firebase in js/auth.js first.', 'error');
    return;
  }

  const emailInput = document.getElementById('authEmailInput');
  const passInput = document.getElementById('authPassInput');
  const email = (emailInput ? emailInput.value : '').trim();
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    LabelApp.Auth.showStatus('Please enter both Email and Password.', 'error');
    return;
  }

  LabelApp.Auth.showStatus('Verifying credentials...', 'info');

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    LabelApp.Auth.resetFailedAttempts();
  } catch (err) {
    console.error('[LabelApp.Auth] Email Login Error:', err);
    LabelApp.Auth.recordFailedAttempt(LabelApp.Auth.formatErrorMessage(err));
  }
};


/**
 * Sign up new operator account with Email & Password
 */
LabelApp.Auth.signupWithEmail = async function() {
  if (!LabelApp.Auth.state.isConfigured) {
    LabelApp.Auth.showStatus('Please configure Firebase in js/auth.js first.', 'error');
    return;
  }

  const emailInput = document.getElementById('authEmailInput');
  const passInput = document.getElementById('authPassInput');
  const email = (emailInput ? emailInput.value : '').trim();
  const password = passInput ? passInput.value : '';

  LabelApp.Auth.showStatus('Public registration is disabled. Administrator access is provisioned via Firebase Console.', 'error');
};

/**
 * Sign Out / Logout
 */
LabelApp.Auth.logout = async function() {
  try {
    if (LabelApp.Auth.state.isConfigured && firebase.auth) {
      await firebase.auth().signOut();
    } else {
      // Dev bypass logout
      LabelApp.Auth.state.isBypassed = false;
      LabelApp.Auth.handleAuthState(null);
    }
  } catch (err) {
    console.error('[LabelApp.Auth] Sign out error:', err);
    alert('Sign out error: ' + err.message);
  }
};

/**
 * Local Developer / Preview Bypass (Enabled when Firebase is not yet configured)
 */
LabelApp.Auth.bypassLocal = function() {
  LabelApp.Auth.state.isBypassed = true;
  const overlay = document.getElementById('authOverlay');
  const wrap = document.querySelector('.wrap');
  const userPill = document.getElementById('authEmailDisplay');
  const statusBar = document.getElementById('authStatusBar');

  if (overlay) overlay.style.display = 'none';
  if (wrap) wrap.classList.remove('app-locked');
  if (userPill) userPill.textContent = 'Local Dev Mode';
  if (statusBar) statusBar.style.display = 'flex';
};

/**
 * UI Message Banner Helpers
 */
LabelApp.Auth.showStatus = function(msg, type) {
  const box = document.getElementById('authStatusBox');
  if (!box) return;
  box.textContent = msg;
  box.className = 'auth-status-box ' + (type || 'info');
  box.style.display = 'block';
};

LabelApp.Auth.clearStatus = function() {
  const box = document.getElementById('authStatusBox');
  if (!box) return;
  box.textContent = '';
  box.style.display = 'none';
};

/**
 * Human-friendly error translation
 */
LabelApp.Auth.formatErrorMessage = function(err) {
  const code = err.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password. Please verify and try again.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'This email is already registered. Please click "Sign In" instead.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google Sign-In popup was closed before completing.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network connection failed. Please check your internet.';
  }
  return err.message || 'Authentication error. Please try again.';
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  LabelApp.Auth.init();
});
