const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyOwnerOrAdmin } = require('../middleware/auth');

router.get('/:id', verifyOwnerOrAdmin, studentController.getStudentProfile);
router.put('/:id/eng_score', verifyOwnerOrAdmin, studentController.updateEngscore);
router.put('/:id/target_honor', verifyOwnerOrAdmin, studentController.updateTargetHonor);
router.put('/:id/study_info', verifyOwnerOrAdmin, studentController.updateStudentInfo);
router.put('/:id/password', verifyOwnerOrAdmin, studentController.changePassword);
router.delete('/:id/account', verifyOwnerOrAdmin, studentController.deleteAccount);

module.exports = router;