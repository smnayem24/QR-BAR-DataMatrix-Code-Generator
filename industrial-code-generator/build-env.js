/**
 * ==============================================================================
 * BUILD-ENV: Environment Variable Builder for Netlify & Local Development
 * Zero-dependency: Uses native Node.js fs & path modules.
 * Reads: .env file and/or system environment variables (Netlify Dashboard)
 * Generates: js/env.js for runtime client-side access.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// 1. Simple parser for .env file
function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();

      // Remove wrapping single or double quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

// 2. Resolve environment variables (process.env takes precedence over .env file)
const rootDir = __dirname;
const envFilePath = path.join(rootDir, '.env');
const fileEnv = parseEnvFile(envFilePath);

function getVar(key, fallback = '') {
  if (process.env[key] !== undefined && process.env[key] !== '') {
    return process.env[key];
  }
  if (fileEnv[key] !== undefined && fileEnv[key] !== '') {
    return fileEnv[key];
  }
  return fallback;
}

// 3. Extract Firebase & Whitelist credentials
const firebaseConfig = {
  apiKey: getVar('FIREBASE_API_KEY', 'YOUR_API_KEY'),
  authDomain: getVar('FIREBASE_AUTH_DOMAIN', 'YOUR_PROJECT_ID.firebaseapp.com'),
  projectId: getVar('FIREBASE_PROJECT_ID', 'YOUR_PROJECT_ID'),
  storageBucket: getVar('FIREBASE_STORAGE_BUCKET', 'YOUR_PROJECT_ID.appspot.com'),
  messagingSenderId: getVar('FIREBASE_MESSAGING_SENDER_ID', 'YOUR_MESSAGING_SENDER_ID'),
  appId: getVar('FIREBASE_APP_ID', 'YOUR_APP_ID')
};

const rawEmails = getVar('WHITELISTED_EMAILS', '');
const whitelistedEmails = rawEmails
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// 4. Generate js/env.js output
const outputContent = `/**
 * ==============================================================================
 * AUTO-GENERATED CLIENT ENVIRONMENT CONFIGURATION
 * Generated automatically from .env or Netlify environment variables by build-env.js.
 * This file is excluded from git repository tracking (.gitignore).
 * ==============================================================================
 */

window.FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig, null, 2)};

window.WHITELISTED_EMAILS = ${JSON.stringify(whitelistedEmails, null, 2)};
`;

const jsDir = path.join(rootDir, 'js');
if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

const targetPath = path.join(jsDir, 'env.js');
fs.writeFileSync(targetPath, outputContent, 'utf8');

console.log('[build-env] ✅ Successfully generated js/env.js');
console.log(`[build-env] Whitelisted accounts: ${whitelistedEmails.length ? whitelistedEmails.join(', ') : 'None configured yet'}`);
