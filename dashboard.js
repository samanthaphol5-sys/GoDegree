const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyOwnerOrAdmin } = require('../middleware/auth');

router.get('/:id/progress', verifyOwnerOrAdmin, dashboardController.getDashboardProgress);

module.exports = router;