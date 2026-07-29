const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const { upload, UPLOAD_DIR } = require('../upload');

const router = express.Router();

const FIELD_MAP = {
  mediaKind: 'media_kind',
  visualStyle: 'visual_style',
  title: 'title',
  dur: 'dur',
  tool: 'tool',
  inputDesc: 'input_desc',
  comment: 'comment'
};

router.post('/', async (req, res, next) => {
  try {
    const { app, dateGroup } = req.body;
    if (!app || !dateGroup) return res.status(400).json({ error: 'Thiếu app hoặc dateGroup' });
    const { rows: maxRows } = await query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM rows WHERE app = $1', [app]);
    const sortOrder = Number(maxRows[0].m) + 1;
    const { rows } = await query(
      `INSERT INTO rows (app, media_kind, visual_style, title, dur, tool, date_group, input_desc, comment, sort_order)
       VALUES ($1,'video','','','','',$2,'','',$3) RETURNING id`,
      [app, dateGroup, sortOrder]
    );
    res.json({ id: rows[0].id });
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sets = [];
    const params = [];
    Object.entries(req.body || {}).forEach(([key, val]) => {
      const col = FIELD_MAP[key];
      if (!col) return;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    });
    if (!sets.length) return res.status(400).json({ error: 'Không có field hợp lệ để sửa' });
    params.push(id);
    await query(`UPDATE rows SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: media } = await query("SELECT * FROM row_media WHERE row_id = $1 AND kind = 'upload'", [id]);
    media.forEach(m => {
      const p = path.join(UPLOAD_DIR, m.media_id || '');
      if (m.media_id && fs.existsSync(p)) fs.unlinkSync(p);
    });
    await query('DELETE FROM rows WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/media', upload.single('file'), async (req, res, next) => {
  try {
    const rowId = Number(req.params.id);
    const slot = req.body.slot === 'reference' ? 'reference' : 'result';
    const { rows: rowCheck } = await query('SELECT id FROM rows WHERE id = $1', [rowId]);
    if (!rowCheck.length) return res.status(404).json({ error: 'Row không tồn tại' });

    const { rows: maxRows } = await query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM row_media WHERE row_id = $1 AND slot = $2', [rowId, slot]);
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
      `INSERT INTO row_media (row_id, slot, kind, drive_id, media_id, media_type, caption, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [rowId, slot, insertData.kind, insertData.driveId, insertData.mediaId, insertData.mediaType, insertData.caption, sortOrder]
    );
    res.json({ id: rows[0].id, ...insertData });
  } catch (e) { next(e); }
});

module.exports = router;
