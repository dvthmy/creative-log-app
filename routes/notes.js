const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { upload, UPLOAD_DIR } = require('../upload');

const router = express.Router();

router.post('/media', upload.single('file'), (req, res) => {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM notes_media').get().m;
  let insertData;
  if (req.file) {
    insertData = { kind: 'upload', driveId: null, mediaId: req.file.filename, mediaType: req.file.mimetype, caption: req.body.caption || '' };
  } else if (req.body.driveId) {
    insertData = { kind: 'drive', driveId: req.body.driveId, mediaId: null, mediaType: null, caption: req.body.caption || '' };
  } else {
    return res.status(400).json({ error: 'Cần file upload hoặc driveId' });
  }
  const info = db.prepare(`
    INSERT INTO notes_media (kind, drive_id, media_id, media_type, caption, sort_order)
    VALUES (@kind, @driveId, @mediaId, @mediaType, @caption, @sortOrder)
  `).run({ sortOrder: maxOrder + 1, ...insertData });
  res.json({ id: info.lastInsertRowid, ...insertData });
});

router.patch('/media/:id', (req, res) => {
  const id = Number(req.params.id);
  if (typeof req.body.caption !== 'string') return res.status(400).json({ error: 'Thiếu caption' });
  db.prepare('UPDATE notes_media SET caption = ? WHERE id = ?').run(req.body.caption, id);
  res.json({ ok: true });
});

router.delete('/media/:id', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM notes_media WHERE id = ?').get(id);
  if (m && m.kind === 'upload' && m.media_id) {
    const p = path.join(UPLOAD_DIR, m.media_id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  db.prepare('DELETE FROM notes_media WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
