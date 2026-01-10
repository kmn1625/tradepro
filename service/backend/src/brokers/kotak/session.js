let session = {
  accessToken: null,
  refreshToken: null,
  lastLogin: null,
};

module.exports = {
  setSession(data) {
    session = { ...session, ...data };
  },

  getSession() {
    return session;
  },

  isAuthenticated() {
    return !!session.accessToken;
  },
};
