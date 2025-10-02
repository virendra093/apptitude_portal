const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

router.get('/', testController.getTest);
router.get('/question', testController.getQuestion);
router.post('/submit', testController.submitAnswer);

module.exports = router;