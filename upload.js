const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function newId() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, newId() + ext);
  }
});

const MAX_FILE_SIZE = 200 * 1024 * 1024; // giữ đúng ngưỡng 200MB như bản gốc

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!/^image\/|^video\//.test(file.mimetype)) return cb(new Error('Chỉ nhận ảnh hoặc video'));
    cb(null, true);
  }
});

module.exports = { upload, UPLOAD_DIR, MAX_FILE_SIZE };
