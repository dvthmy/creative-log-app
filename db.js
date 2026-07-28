const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    row_id INTEGER NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    kind TEXT NOT NULL,
    drive_id TEXT,
    media_id TEXT,
    media_type TEXT,
    caption TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS notes_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    drive_id TEXT,
    media_id TEXT,
    media_type TEXT,
    caption TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS plan_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visual_style TEXT DEFAULT '',
    app TEXT DEFAULT 'Soulie',
    media_kind TEXT DEFAULT 'video',
    count INTEGER DEFAULT 0,
    groups TEXT DEFAULT '',
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
`);

function insertRowMedia(rowId, slot, items) {
  const stmt = db.prepare(`
    INSERT INTO row_media (row_id, slot, kind, drive_id, media_id, media_type, caption, sort_order)
    VALUES (@rowId, @slot, @kind, @driveId, @mediaId, @mediaType, @caption, @sortOrder)
  `);
  items.forEach((item, idx) => {
    stmt.run({
      rowId, slot,
      kind: item.driveId ? 'drive' : 'upload',
      driveId: item.driveId || null,
      mediaId: item.mediaId || null,
      mediaType: item.mediaType || null,
      caption: item.caption || '',
      sortOrder: idx
    });
  });
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM rows').get().n;
  if (count > 0) return;

  const seedPath = path.join(__dirname, 'seed-data.json');
  if (!fs.existsSync(seedPath)) return;
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const insertRow = db.prepare(`
    INSERT INTO rows (app, media_kind, visual_style, title, dur, tool, date_group, input_desc, comment, sort_order)
    VALUES (@app, @mediaKind, @visualStyle, @title, @dur, @tool, @dateGroup, @inputDesc, @comment, @sortOrder)
  `);

  const seedApp = (appKey, rowsArr) => {
    rowsArr.forEach((r, idx) => {
      const info = insertRow.run({
        app: appKey,
        mediaKind: r.mediaKind || 'video',
        visualStyle: r.visualStyle || '',
        title: r.title || '',
        dur: r.dur || '',
        tool: r.tool || '',
        dateGroup: r.dateGroup,
        inputDesc: r.inputDesc || '',
        comment: r.comment || '',
        sortOrder: idx
      });
      const rowId = info.lastInsertRowid;
      insertRowMedia(rowId, 'reference', r.reference || []);
      insertRowMedia(rowId, 'result', r.result || []);
    });
  };

  const tx = db.transaction(() => {
    seedApp('bookwise', seed.bookwiseRows || []);
    seedApp('soulie', seed.soulieRows || []);

    const insertNote = db.prepare(`
      INSERT INTO notes_media (kind, drive_id, media_id, media_type, caption, sort_order)
      VALUES (@kind, @driveId, @mediaId, @mediaType, @caption, @sortOrder)
    `);
    (seed.notesGal || []).forEach((item, idx) => {
      insertNote.run({
        kind: item.driveId ? 'drive' : 'upload',
        driveId: item.driveId || null,
        mediaId: item.mediaId || null,
        mediaType: item.mediaType || null,
        caption: item.caption || '',
        sortOrder: idx
      });
    });

    const insertSw = db.prepare(`
      INSERT INTO sw_state (group_key, good_html, bad_html) VALUES (@groupKey, @good, @bad)
      ON CONFLICT(group_key) DO UPDATE SET good_html=excluded.good_html, bad_html=excluded.bad_html
    `);
    Object.entries(seed.swState || {}).forEach(([groupKey, val]) => {
      insertSw.run({ groupKey, good: val.good || '', bad: val.bad || '' });
    });

    db.prepare(`
      INSERT INTO ui_state (id, collapsed_json, texts_json, group_collapsed_json)
      VALUES (1, '{}', '{}', '{}')
      ON CONFLICT(id) DO NOTHING
    `).run();
  });
  tx();
}

seedIfEmpty();

module.exports = db;
