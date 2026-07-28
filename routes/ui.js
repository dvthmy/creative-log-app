const express = require('express');
const db = require('../db');

const router = express.Router();

router.put('/', (req, res) => {
  const { collapsed, texts, groupCollapsed } = req.body || {};
  db.prepare(`
    INSERT INTO ui_state (id, collapsed_json, texts_json, group_collapsed_json)
    VALUES (1, @collapsed, @texts, @groupCollapsed)
    ON CONFLICT(id) DO UPDATE SET collapsed_json = @collapsed, texts_json = @texts, group_collapsed_json = @groupCollapsed
  `).run({
    collapsed: JSON.stringify(collapsed || {}),
    texts: JSON.stringify(texts || {}),
    groupCollapsed: JSON.stringify(groupCollapsed || {})
  });
  res.json({ ok: true });
});

module.exports = router;
