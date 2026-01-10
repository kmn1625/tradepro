const express = require("express");
const router = express.Router();
const kotakAuth = require("../brokers/kotak/auth");
const session = require("../brokers/kotak/session");

router.post("/login", async (req, res) => {
  try {
    const data = await kotakAuth.login();
    res.json({
      status: "OK",
      message: "Kotak login successful",
      data,
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

router.get("/status", (req, res) => {
  res.json({
    authenticated: session.isAuthenticated(),
    session: session.getSession(),
  });
});

module.exports = router;
