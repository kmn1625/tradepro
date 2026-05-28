// auth.routes.js
const express = require('express');
const router = express.Router();
const kotakAuth = require('../brokers/kotak/auth');
const session = require('../brokers/kotak/session');

router.post('/login', async (req, res) => {
  try {
    const data = await kotakAuth.login();
    res.json({ status: 'OK', message: 'Kotak login successful', data });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
});

router.get('/status', (req, res) => {
  const s = session.getSession();
  res.json({
    authenticated: session.isAuthenticated(),
    lastLogin: s.lastLogin,
  });
});

router.post('/logout', (req, res) => {
  session.clearSession();
  res.json({ status: 'OK', message: 'Logged out' });
});

module.exports = router;
