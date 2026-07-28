const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { upload, UPLOAD_DIR } = require('../upload');
const { getRowsForApp } = require('../serialize');

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

router.post('/', (req, res) => {
  const { app, dateGroup } = req.body;
  if (!app || !dateGroup) return res.status(400).json({ error: 'Thiếu app hoặc dateGroup' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM rows WHERE app = ?').get(app).m;
  const info = db.prepare(`
    INSERT INTO rows (app, media_kind, visual_style, title, dur, tool, date_group, input_desc, comment, sort_order)
    VALUES (@app, 'video', '', '', '', '', @dateGroup, '', '', @sortOrder)
  `).run({ app, dateGroup, sortOrder: maxOrder + 1 });
  res.json({ id: info.lastInsertRowid });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const updates = [];
  const params = { id };
  Object.entries(req.body || {}).forEach(([key, val]) => {
    const col = FIELD_MAP[key];
    if (!col) return;
    updates.push(`${col} = @${key}`);
    params[key] = val;
  });
  if (!updates.length) return res.status(400).json({ error: 'Không có field hợp lệ để sửa' });
  db.prepare(`UPDATE rows SET ${updates.join(', ')} WHERE id = @id`).run(params);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const media = db.prepare("SELECT * FROM row_media WHERE row_id = ? AND kind = 'upload'").all(id);
  media.forEach(m => {
    const p = path.join(UPLOAD_DIR, m.media_id || '');
    if (m.media_id && fs.existsSync(p)) fs.unlinkSync(p);
  });
  db.prepare('DELETE FROM rows WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.post('/:id/media', upload.single('file'), (req, res) => {
  const rowId = Number(req.params.id);
  const slot = req.body.slot === 'reference' ? 'reference' : 'result';
  const row = db.prepare('SELECT id FROM rows WHERE id = ?').get(rowId);
  if (!row) return res.status(404).json({ error: 'Row không tồn tại' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM row_media WHERE row_id = ? AND slot = ?').get(rowId, slot).m;

  let insertData;
  if (req.file) {
    insertData = { kind: 'upload', driveId: null, mediaId: req.file.filename, mediaType: req.file.mimetype, caption: req.body.caption || '' };
  } else if (req.body.driveId) {
    insertData = { kind: 'drive', driveId: req.body.driveId, mediaId: null, mediaType: null, caption: req.body.caption || '' };
  } else {
    return res.status(400).json({ error: 'Cần file upload hoặc driveId' });
  }

  const info = db.prepare(`
    INSERT INTO row_media (row_id, slot, kind, drive_id, media_id, media_type, caption, sort_order)
    VALUES (@rowId, @slot, @kind, @driveId, @mediaId, @mediaType, @caption, @sortOrder)
  `).run({ rowId, slot, sortOrder: maxOrder + 1, ...insertData });

  res.json({ id: info.lastInsertRowid, ...insertData });
});

module.exports = router;
