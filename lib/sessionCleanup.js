'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const SESSION_DIR = path.join(__dirname, '../data/session/auth.db');

// Files that must never be touched
const PROTECTED = new Set([
  'creds.json',
  '.session_id_hash',
]);

// How many session indices to keep per contact (keep the N highest)
const KEEP_SESSION_INDICES = 2;
// How many pre-keys to keep (keep the N highest-numbered)
const KEEP_PREKEYS = 150;
// How many app-state-sync-key files to keep (keep the N highest)
const KEEP_APPSTATE_KEYS = 10;

function cleanSessions() {
  if (!fs.existsSync(SESSION_DIR)) return { removed: 0, freed: 0 };

  let removed = 0;
  let freedBytes = 0;

  try {
    const allFiles = fs.readdirSync(SESSION_DIR);

    // ── 1. Session files — group by contact, keep top N indices ──────────────
    const sessionMap = new Map(); // base → [{ file, index }]
    for (const f of allFiles) {
      if (!f.startsWith('session-') || !f.endsWith('.json')) continue;
      const match = f.match(/^(session-.+)\.(\d+)\.json$/);
      if (!match) continue;
      const base = match[1];
      const idx = parseInt(match[2], 10);
      if (!sessionMap.has(base)) sessionMap.set(base, []);
      sessionMap.get(base).push({ file: f, index: idx });
    }

    for (const [, entries] of sessionMap) {
      if (entries.length <= KEEP_SESSION_INDICES) continue;
      // Sort descending by index — highest first
      entries.sort((a, b) => b.index - a.index);
      const toDelete = entries.slice(KEEP_SESSION_INDICES);
      for (const { file } of toDelete) {
        const fp = path.join(SESSION_DIR, file);
        try {
          const size = fs.statSync(fp).size;
          fs.unlinkSync(fp);
          removed++;
          freedBytes += size;
        } catch {}
      }
    }

    // ── 2. Pre-key files — keep N highest-numbered ────────────────────────────
    const preKeys = allFiles
      .filter(f => /^pre-key-\d+\.json$/.test(f))
      .map(f => ({ file: f, num: parseInt(f.match(/(\d+)/)[1], 10) }))
      .sort((a, b) => b.num - a.num);

    const preKeysToDelete = preKeys.slice(KEEP_PREKEYS);
    for (const { file } of preKeysToDelete) {
      const fp = path.join(SESSION_DIR, file);
      try {
        const size = fs.statSync(fp).size;
        fs.unlinkSync(fp);
        removed++;
        freedBytes += size;
      } catch {}
    }

    // ── 3. App-state-sync-key files — keep N highest ─────────────────────────
    const appKeys = allFiles
      .filter(f => /^app-state-sync-key-.+\.json$/.test(f))
      .sort()
      .reverse();

    const appKeysToDelete = appKeys.slice(KEEP_APPSTATE_KEYS);
    for (const file of appKeysToDelete) {
      if (PROTECTED.has(file)) continue;
      const fp = path.join(SESSION_DIR, file);
      try {
        const size = fs.statSync(fp).size;
        fs.unlinkSync(fp);
        removed++;
        freedBytes += size;
      } catch {}
    }

  } catch (err) {
    console.error(chalk.red('[SessionClean] Error:'), err.message);
  }

  return { removed, freed: freedBytes };
}

function runCleanup(label = 'startup') {
  try {
    const before = countSessionFiles();
    const { removed, freed } = cleanSessions();
    if (removed > 0) {
      const kb = (freed / 1024).toFixed(1);
      console.log(chalk.cyan(`[SessionClean] ${label}: removed ${removed} stale files, freed ${kb} KB (${before} → ${before - removed} files)`));
    }
  } catch {}
}

function countSessionFiles() {
  try { return fs.readdirSync(SESSION_DIR).length; } catch { return 0; }
}

let _cleanupTimer = null;

function startPeriodicCleanup(intervalHours = 12) {
  runCleanup('startup');
  if (_cleanupTimer) clearInterval(_cleanupTimer);
  _cleanupTimer = setInterval(() => {
    runCleanup('periodic');
  }, intervalHours * 60 * 60 * 1000);
  if (_cleanupTimer.unref) _cleanupTimer.unref();
}

module.exports = { startPeriodicCleanup, runCleanup, cleanSessions };
