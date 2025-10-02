const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/dashboard', adminController.getDashboard);
router.get('/results', adminController.getResults);
router.post('/change-password', adminController.changePassword);
router.get('/logout', adminController.logout);
router.get('/api/check', adminController.checkLoginStatus);

// Question management routes
router.get('/questions', adminController.getQuestionsPage);
router.get('/api/questions', adminController.getQuestions);
router.post('/api/questions', adminController.addQuestion);
router.get('/api/questions/:id', adminController.getQuestion);
router.put('/api/questions/:id', adminController.updateQuestion);
router.delete('/api/questions/:id', adminController.deleteQuestion);

module.exports = router; 