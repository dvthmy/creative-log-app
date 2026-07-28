const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { UPLOAD_DIR } = require('../upload');

const router = express.Router();

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (typeof req.body.caption !== 'string') return res.status(400).json({ error: 'Thiếu caption' });
  db.prepare('UPDATE row_media SET caption = ? WHERE id = ?').run(req.body.caption, id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM row_media WHERE id = ?').get(id);
  if (m && m.kind === 'upload' && m.media_id) {
    const p = path.join(UPLOAD_DIR, m.media_id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  db.prepare('DELETE FROM row_media WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
