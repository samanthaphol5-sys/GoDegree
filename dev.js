const express = require('express');
const router = express.Router();
const devController = require('../controllers/devController');
const { verifyToken, requireDev } = require('../middleware/auth');

router.use(verifyToken, requireDev);

router.get('/stats', devController.getStats);
router.get('/users', devController.getUsers);
router.get('/request-log', devController.getRequestLog);

module.exports = router;