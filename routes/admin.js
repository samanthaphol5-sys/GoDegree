const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken, requireAdmin);

router.get('/users', adminController.getUsers);
router.post('/courses', adminController.addCourse);
router.delete('/courses/:courseCode', adminController.deleteCourse);

// Academic catalog management
router.get('/catalogs', adminController.getCatalogs);
router.post('/catalogs', adminController.addCatalog);
router.put('/catalogs/:catalogYear', adminController.updateCatalog);
router.delete('/catalogs/:catalogYear', adminController.deleteCatalog);

module.exports = router;