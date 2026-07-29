const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.put('/:groupKey', async (req, res, next) => {
  try {
    const { groupKey } = req.params;
    const good = typeof req.body.good === 'string' ? req.body.good : '';
    const bad = typeof req.body.bad === 'string' ? req.body.bad : '';
    await query(
      `INSERT INTO sw_state (group_key, good_html, bad_html) VALUES ($1,$2,$3)
       ON CONFLICT (group_key) DO UPDATE SET good_html = $2, bad_html = $3`,
      [groupKey, good, bad]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
