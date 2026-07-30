const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function query(text, params) {
  return pool.query(text, params);
}

async function createSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS rows (
      id SERIAL PRIMARY KEY,
      app TEXT NOT NULL,
      media_kind TEXT NOT NULL DEFAULT 'video',
      visual_style TEXT DEFAULT '',
      title TEXT DEFAULT '',
      dur TEXT DEFAULT '',
      tool TEXT DEFAULT '',
      date_group TEXT NOT NULL,
      input_desc TEXT DEFAULT '',
      comment TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS row_media (
      id SERIAL PRIMARY KEY,
      row_id INTEGER NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
      slot TEXT NOT NULL,
      kind TEXT NOT NULL,
      drive_id TEXT,
      media_id TEXT,
      media_type TEXT,
      caption TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      highlighted BOOLEAN NOT NULL DEFAULT FALSE
    );

    ALTER TABLE row_media ADD COLUMN IF NOT EXISTS highlighted BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS notes_media (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      drive_id TEXT,
      media_id TEXT,
      media_type TEXT,
      caption TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sw_state (
      group_key TEXT PRIMARY KEY,
      good_html TEXT DEFAULT '',
      bad_html TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS ui_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      collapsed_json TEXT DEFAULT '{}',
      texts_json TEXT DEFAULT '{}',
      group_collapsed_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS weeks (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);
}

async function seedWeeksIfEmpty() {
  const { rows } = await query('SELECT COUNT(*) AS n FROM weeks');
  if (Number(rows[0].n) > 0) return;
  await query(
    `INSERT INTO weeks (key, label, sort_order) VALUES ($1,$2,0), ($3,$4,1)`,
    ['1-14', '01–14/07', '15-28', '15–28/07']
  );
}

async function insertRowMedia(client, rowId, slot, items) {
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    await client.query(
      `INSERT INTO row_media (row_id, slot, kind, drive_id, media_id, media_type, caption, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [rowId, slot, item.driveId ? 'drive' : 'upload', item.driveId || null, item.mediaId || null, item.mediaType || null, item.caption || '', idx]
    );
  }
}

async function seedIfEmpty() {
  const { rows: countRows } = await query('SELECT COUNT(*) AS n FROM rows');
  if (Number(countRows[0].n) > 0) return;

  const seedPath = path.join(__dirname, 'seed-data.json');
  if (!fs.existsSync(seedPath)) return;
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const seedApp = async (appKey, rowsArr) => {
      for (let idx = 0; idx < rowsArr.length; idx++) {
        const r = rowsArr[idx];
        const { rows: inserted } = await client.query(
          `INSERT INTO rows (app, media_kind, visual_style, title, dur, tool, date_group, input_desc, comment, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [appKey, r.mediaKind || 'video', r.visualStyle || '', r.title || '', r.dur || '', r.tool || '', r.dateGroup, r.inputDesc || '', r.comment || '', idx]
        );
        const rowId = inserted[0].id;
        await insertRowMedia(client, rowId, 'reference', r.reference || []);
        await insertRowMedia(client, rowId, 'result', r.result || []);
      }
    };

    await seedApp('bookwise', seed.bookwiseRows || []);
    await seedApp('soulie', seed.soulieRows || []);

    const notesGal = seed.notesGal || [];
    for (let idx = 0; idx < notesGal.length; idx++) {
      const item = notesGal[idx];
      await client.query(
        `INSERT INTO notes_media (kind, drive_id, media_id, media_type, caption, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [item.driveId ? 'drive' : 'upload', item.driveId || null, item.mediaId || null, item.mediaType || null, item.caption || '', idx]
      );
    }

    for (const [groupKey, val] of Object.entries(seed.swState || {})) {
      await client.query(
        `INSERT INTO sw_state (group_key, good_html, bad_html) VALUES ($1,$2,$3)
         ON CONFLICT (group_key) DO UPDATE SET good_html = EXCLUDED.good_html, bad_html = EXCLUDED.bad_html`,
        [groupKey, val.good || '', val.bad || '']
      );
    }

    await client.query(
      `INSERT INTO ui_state (id, collapsed_json, texts_json, group_collapsed_json)
       VALUES (1, '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING`
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

const ready = createSchema().then(seedIfEmpty).then(seedWeeksIfEmpty);

module.exports = { query, ready };
