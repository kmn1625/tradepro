// auth.js
const axios = require('axios');
const { authenticator } = require('otplib');
const config = require('./config');
const session = require('./session');

async function login() {
  // TOTP_SECRET must be the base32 secret from Kotak TOTP setup (not a pre-generated code)
  const totpSecret = process.env.KOTAK_TOTP_SECRET;
  if (!totpSecret) {
    throw new Error('KOTAK_TOTP_SECRET not set in .env');
  }

  const totp = authenticator.generate(totpSecret);

  const payload = {
    userId: process.env.KOTAK_USER_ID,
    password: process.env.KOTAK_PASSWORD,
    totp,
  };

  const headers = {
    'Content-Type': 'application/json',
    consumerKey: process.env.KOTAK_CONSUMER_KEY,
    consumerSecret: process.env.KOTAK_CONSUMER_SECRET,
  };

  let response;
  try {
    response = await axios.post(config.BASE_URL + config.LOGIN_ENDPOINT, payload, { headers });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    if (status === 401 || status === 403) {
      const authErr = new Error(`Kotak auth failed: ${msg}`);
      authErr.statusCode = 401;
      throw authErr;
    }
    throw new Error(`Kotak API error: ${msg}`);
  }

  const data = response.data;
  if (!data.data?.accessToken) {
    const authErr = new Error('Kotak login failed: no accessToken in response');
    authErr.statusCode = 401;
    throw authErr;
  }

  session.setSession({
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    lastLogin: new Date().toISOString(),
  });

  return session.getSession();
}

module.exports = { login };
