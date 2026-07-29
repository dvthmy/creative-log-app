const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.put('/', async (req, res, next) => {
  try {
    const { collapsed, texts, groupCollapsed } = req.body || {};
    const params = [JSON.stringify(collapsed || {}), JSON.stringify(texts || {}), JSON.stringify(groupCollapsed || {})];
    await query(
      `INSERT INTO ui_state (id, collapsed_json, texts_json, group_collapsed_json)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET collapsed_json = $1, texts_json = $2, group_collapsed_json = $3`,
      params
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
