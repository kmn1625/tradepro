const alertEngine = require('../services/alertEngine.service');

exports.create = (req, res) => {
  try {
    const alert = alertEngine.createAlert(req.body);
    res.json(alert);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.list = (req, res) => {
  res.json(alertEngine.listAlerts());
};

exports.remove = (req, res) => {
  const id = parseInt(req.params.id);
  const ok = alertEngine.deleteAlert(id);
  res.json({ success: ok });
};

exports.clearTriggered = (req, res) => {
  alertEngine.clearTriggered();
  res.json({ success: true });
};
