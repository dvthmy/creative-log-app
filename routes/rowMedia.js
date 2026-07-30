const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { UPLOAD_DIR } = require('../upload');

const router = express.Router();

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sets = [];
    const values = [];
    if (typeof req.body.caption === 'string') { sets.push(`caption = $${sets.length + 1}`); values.push(req.body.caption); }
    if (typeof req.body.highlighted === 'boolean') { sets.push(`highlighted = $${sets.length + 1}`); values.push(req.body.highlighted); }
    if (!sets.length) return res.status(400).json({ error: 'Thiếu caption/highlighted' });
    values.push(id);
    await query(`UPDATE row_media SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
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
