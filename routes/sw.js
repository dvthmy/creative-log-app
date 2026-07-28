const express = require('express');
const db = require('../db');

const router = express.Router();

router.put('/:groupKey', (req, res) => {
  const { groupKey } = req.params;
  const good = typeof req.body.good === 'string' ? req.body.good : '';
  const bad = typeof req.body.bad === 'string' ? req.body.bad : '';
  db.prepare(`
    INSERT INTO sw_state (group_key, good_html, bad_html) VALUES (@groupKey, @good, @bad)
    ON CONFLICT(group_key) DO UPDATE SET good_html = @good, bad_html = @bad
  `).run({ groupKey, good, bad });
  res.json({ ok: true });
});

module.exports = router;
