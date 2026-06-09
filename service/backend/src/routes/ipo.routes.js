const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ipo.controller');

router.get('/',                ctrl.listAll);
router.get('/applications',    ctrl.listApplications);
router.get('/:id',             ctrl.getById);
router.post('/apply',          ctrl.apply);

module.exports = router;
