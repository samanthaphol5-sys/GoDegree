const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { verifyOwnerOrAdmin } = require('../middleware/auth');

router.get('/student/:id/semester/:year/:sem', verifyOwnerOrAdmin, planController.getMySemester);
router.post('/student/:id/enrollment', verifyOwnerOrAdmin, planController.addCourse);
router.delete('/student/:id/enrollment/:courseCode', verifyOwnerOrAdmin, planController.removeCourse);
router.get('/student/:id/all', verifyOwnerOrAdmin, planController.getAllSemester);

module.exports = router;