const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { upload, UPLOAD_DIR } = require('../upload');

const router = express.Router();

router.post('/media', upload.single('file'), async (req, res, next) => {
  try {
    const { rows: maxRows } = await query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM notes_media');
    const sortOrder = Number(maxRows[0].m) + 1;
    let insertData;
    if (req.file) {
      insertData = { kind: 'upload', driveId: null, mediaId: req.file.filename, mediaType: req.file.mimetype, caption: req.body.caption || '' };
    } else if (req.body.driveId) {
      insertData = { kind: 'drive', driveId: req.body.driveId, mediaId: null, mediaType: null, caption: req.body.caption || '' };
    } else {
      return res.status(400).json({ error: 'Cần file upload hoặc driveId' });
    }
    const { rows } = await query(
      `INSERT INTO notes_media (kind, drive_id, media_id, media_type, caption, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [insertData.kind, insertData.driveId, insertData.mediaId, insertData.mediaType, insertData.caption, sortOrder]
    );
    res.json({ id: rows[0].id, ...insertData });
  } catch (e) { next(e); }
});

router.patch('/media/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (typeof req.body.caption !== 'string') return res.status(400).json({ error: 'Thiếu caption' });
    await query('UPDATE notes_media SET caption = $1 WHERE id = $2', [req.body.caption, id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/media/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM notes_media WHERE id = $1', [id]);
    const m = rows[0];
    if (m && m.kind === 'upload' && m.media_id) {
      const p = path.join(UPLOAD_DIR, m.media_id);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await query('DELETE FROM notes_media WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
