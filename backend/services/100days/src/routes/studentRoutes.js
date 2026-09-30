const express = require('express');
const { getMyScore } = require('../controllers/studentController');

const router = express.Router();
router.get('/my-score', getMyScore);

module.exports = router;
