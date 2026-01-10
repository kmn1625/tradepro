const axios = require("axios");
const config = require("./config");
const session = require("./session");

async function login() {
  const payload = {
    userId: process.env.KOTAK_USER_ID,
    password: process.env.KOTAK_PASSWORD,
    totp: process.env.KOTAK_TOTP,
  };

  const headers = {
    "Content-Type": "application/json",
    consumerKey: process.env.KOTAK_CONSUMER_KEY,
    consumerSecret: process.env.KOTAK_CONSUMER_SECRET,
  };

  const response = await axios.post(
    config.BASE_URL + config.LOGIN_ENDPOINT,
    payload,
    { headers }
  );

  const data = response.data;

  if (!data.data?.accessToken) {
    throw new Error("Kotak login failed");
  }

  session.setSession({
    accessToken: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    lastLogin: new Date(),
  });

  return session.getSession();
}

module.exports = {
  login,
};
