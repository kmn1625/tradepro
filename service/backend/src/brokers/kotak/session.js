// session.js - file-backed persistence so session survives server restarts
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '../../../../.session.json');

function loadFromDisk() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch (_) {}
  return { accessToken: null, refreshToken: null, lastLogin: null };
}

function saveToDisk(data) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Session save failed:', err.message);
  }
}

let session = loadFromDisk();

module.exports = {
  setSession(data) {
    session = { ...session, ...data };
    saveToDisk(session);
  },

  getSession() {
    return session;
  },

  isAuthenticated() {
    return !!session.accessToken;
  },

  clearSession() {
    session = { accessToken: null, refreshToken: null, lastLogin: null };
    saveToDisk(session);
  },
};
