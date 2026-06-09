const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/alerts.controller');

router.post('/',            ctrl.create);
router.get('/',             ctrl.list);
router.delete('/:id',       ctrl.remove);
router.delete('/triggered', ctrl.clearTriggered);

module.exports = router;
