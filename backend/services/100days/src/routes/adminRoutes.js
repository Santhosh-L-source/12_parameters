const express = require('express');
const multer = require('multer');
const ctrl = require('../controllers/adminController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'application/octet-stream'];
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (['csv', 'xlsx', 'xls'].includes(ext)) return cb(null, true);
    cb(new Error('Only CSV and Excel files are accepted'));
  },
});

router.post('/lists/upload', upload.single('file'), ctrl.uploadList);
router.get('/lists/:id/preview', ctrl.previewList);
router.post('/lists/:id/approve', ctrl.approveList);
router.post('/lists/:id/reject', ctrl.rejectList);
router.get('/lists', ctrl.getLists);
router.get('/scores/export', ctrl.exportScores);
router.get('/scores', ctrl.getScores);
router.get('/audit/:studentId', ctrl.getAuditLog);

module.exports = router;
