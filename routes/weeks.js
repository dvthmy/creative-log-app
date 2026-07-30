const express = require('express');
const { query } = require('../db');

const router = express.Router();

function pad2(n) { return String(n).padStart(2, '0'); }
function formatLabel(startDate, endDate) {
  const s = new Date(startDate + 'T00:00:00');
  const e = new Date(endDate + 'T00:00:00');
  return pad2(s.getDate()) + '/' + pad2(s.getMonth() + 1) + '–' + pad2(e.getDate()) + '/' + pad2(e.getMonth() + 1);
}

router.post('/', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body || {};
    if (!startDate || !endDate) return res.status(400).json({ error: 'Thiếu ngày bắt đầu/kết thúc' });
    const key = startDate.replace(/-/g, '') + '-' + endDate.replace(/-/g, '');
    const label = formatLabel(startDate, endDate);
    const { rows: maxRows } = await query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM weeks');
    const sortOrder = Number(maxRows[0].m) + 1;
    const { rows } = await query(
      `INSERT INTO weeks (key, label, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO NOTHING RETURNING id`,
      [key, label, sortOrder]
    );
    if (!rows.length) return res.status(409).json({ error: 'Tuần này đã tồn tại' });
    res.json({ id: rows[0].id, key, label, sortOrder });
  } catch (e) { next(e); }
});

module.exports = router;
