const express = require('express');
const db = require('../db');
const { getPlanRows, computePlanRows } = require('../serialize');

const router = express.Router();

function replacePlanRows(rows) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM plan_rows').run();
    const insert = db.prepare(`
      INSERT INTO plan_rows (visual_style, app, media_kind, count, groups, sort_order)
      VALUES (@visualStyle, @app, @mediaKind, @count, @groups, @sortOrder)
    `);
    rows.forEach((r, idx) => insert.run({
      visualStyle: r.visualStyle || '',
      app: r.app || 'Soulie',
      mediaKind: r.mediaKind || 'video',
      count: Number(r.count) || 0,
      groups: r.groups || '',
      sortOrder: idx
    }));
  });
  tx();
}

router.put('/', (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  replacePlanRows(rows);
  res.json({ rows: getPlanRows() });
});

router.post('/resync', (req, res) => {
  replacePlanRows(computePlanRows());
  res.json({ rows: getPlanRows() });
});

module.exports = router;
