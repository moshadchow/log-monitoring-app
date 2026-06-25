const express = require('express');
const monitorController = require('../controllers/monitor.controller');

const router = express.Router();

router.get('/status', monitorController.getStatus);
router.post('/run-now', monitorController.runNow);
router.get('/version', monitorController.getVersion);

module.exports = router;
