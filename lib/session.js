const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const SESSION_DIR = path.join(__dirname, '../data/session/auth.db');
const CREDS_PATH = path.join(SESSION_DIR, 'creds.json');

// =========================================================
// Load session from SESSION_ID environment variable
// =========================================================
const HASH_PATH = path.join(SESSION_DIR, '.session_id_hash');

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
  return Math.abs(h).toString(16);
}

function loadEnvSession() {
  const envSession = process.env.SESSION_ID;

  if (!envSession || envSession.trim() === '') {
    return false;
  }

  const newHash = hashString(envSession.trim());

  // Session already on disk — only overwrite if SESSION_ID has changed
  if (fs.existsSync(CREDS_PATH)) {
    const oldHash = fs.existsSync(HASH_PATH) ? fs.readFileSync(HASH_PATH, 'utf8').trim() : '';
    if (oldHash === newHash) {
      console.log(chalk.cyan('[DAVEX-ULTRA] Existing session found on disk (SESSION_ID unchanged)'));
      return true;
    }
    // SESSION_ID changed — clear old session so we load the new one
    console.log(chalk.yellow('[DAVEX-ULTRA] SESSION_ID changed — clearing old session and reloading...'));
    try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  console.log(chalk.yellow('[DAVEX-ULTRA] SESSION_ID found in env — loading...'));

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  try {
    let sessionString = envSession.trim();

    // Remove known prefixes
    const prefixes = ['DAVEX-ULTRA:', 'DAVE-X:~', 'DAVE-X:', 'DAVE-MD:', 'DAVE-AI:', 'SESSION:', 'BAILEYS:', 'MD:'];
    for (const prefix of prefixes) {
      if (sessionString.toUpperCase().startsWith(prefix.toUpperCase())) {
        sessionString = sessionString.slice(prefix.length).trim();
        break;
      }
    }

    let parsed = null;

    // Attempt 1: Raw JSON
    if (sessionString.startsWith('{') && sessionString.endsWith('}')) {
      try { parsed = JSON.parse(sessionString); } catch (e) {}
    }

    // Attempt 2: Standard base64
    if (!parsed) {
      try {
        const decoded = Buffer.from(sessionString, 'base64').toString('utf8');
        if (decoded.includes('{')) parsed = JSON.parse(decoded);
      } catch (e) {}
    }

    // Attempt 3: URL-safe base64
    if (!parsed) {
      try {
        const safe = sessionString.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(safe, 'base64').toString('utf8');
        if (decoded.includes('{')) parsed = JSON.parse(decoded);
      } catch (e) {}
    }

    // Attempt 4: Hex
    if (!parsed) {
      try {
        const decoded = Buffer.from(sessionString, 'hex').toString('utf8');
        if (decoded.includes('{')) parsed = JSON.parse(decoded);
      } catch (e) {}
    }

    // Attempt 5: Extract JSON from string
    if (!parsed) {
      const match = sessionString.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (e) {}
      }
    }

    if (!parsed) {
      console.log(chalk.red('[DAVEX-ULTRA] Could not parse SESSION_ID in any known format'));
      return false;
    }

    // Validate it's a Baileys session
    const required = ['noiseKey', 'signedIdentityKey', 'signedPreKey', 'registrationId'];
    const hasRequired = required.some(k => parsed.hasOwnProperty(k));
    if (!hasRequired) {
      console.log(chalk.red('[DAVEX-ULTRA] SESSION_ID missing required Baileys fields'));
      return false;
    }

    fs.writeFileSync(CREDS_PATH, JSON.stringify(parsed, null, 2));
    try { fs.writeFileSync(HASH_PATH, newHash); } catch (_) {}
    console.log(chalk.green('[DAVEX-ULTRA] Session loaded from SESSION_ID env successfully'));
    return true;

  } catch (error) {
    console.log(chalk.red('[DAVEX-ULTRA] Unexpected error loading session:'), error.message);
    return false;
  }
}

// =========================================================
// Parse and save a pasted session string
// =========================================================
function parseAndSaveSession(sessionInput) {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  try {
    let sessionData = sessionInput.trim();

    const prefixes = ['DAVEX-ULTRA:', 'DAVE-X:~', 'DAVE-X:', 'DAVE-MD:', 'DAVE-AI:', 'SESSION:', 'BAILEYS:', 'MD:'];
    for (const prefix of prefixes) {
      if (sessionData.toUpperCase().startsWith(prefix.toUpperCase())) {
        sessionData = sessionData.slice(prefix.length).trim();
        break;
      }
    }

    let credsJson = null;

    if (sessionData.startsWith('{') && sessionData.endsWith('}')) {
      try { credsJson = JSON.parse(sessionData); } catch (e) {}
    }

    if (!credsJson) {
      try {
        const decoded = Buffer.from(sessionData, 'base64').toString('utf8');
        if (decoded.includes('{')) credsJson = JSON.parse(decoded);
      } catch (e) {}
    }

    if (!credsJson) {
      try {
        const safe = sessionData.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(safe, 'base64').toString('utf8');
        if (decoded.includes('{')) credsJson = JSON.parse(decoded);
      } catch (e) {}
    }

    if (!credsJson) {
      const match = sessionData.match(/\{[\s\S]*\}/);
      if (match) {
        try { credsJson = JSON.parse(match[0]); } catch (e) {}
      }
    }

    if (!credsJson) {
      return { success: false, error: 'Could not parse session in any known format' };
    }

    const required = ['noiseKey', 'signedIdentityKey', 'signedPreKey', 'registrationId'];
    const hasRequired = required.some(k => credsJson.hasOwnProperty(k));
    if (!hasRequired) {
      return { success: false, error: 'Not a valid Baileys session (missing required keys)' };
    }

    fs.writeFileSync(CREDS_PATH, JSON.stringify(credsJson, null, 2));
    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =========================================================
// Clear session (for logout/re-pair)
// =========================================================
function clearSession() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    return true;
  } catch (e) {
    return false;
  }
}

function hasSession() {
  return fs.existsSync(CREDS_PATH);
}

module.exports = { loadEnvSession, parseAndSaveSession, clearSession, hasSession };
