const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { UPLOAD_DIR } = require('../upload');

const router = express.Router();

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (typeof req.body.caption !== 'string') return res.status(400).json({ error: 'Thiếu caption' });
    await query('UPDATE row_media SET caption = $1 WHERE id = $2', [req.body.caption, id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM row_media WHERE id = $1', [id]);
    const m = rows[0];
    if (m && m.kind === 'upload' && m.media_id) {
      const p = path.join(UPLOAD_DIR, m.media_id);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await query('DELETE FROM row_media WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
