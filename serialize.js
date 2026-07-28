const db = require('./db');

function mediaItemOut(m) {
  const out = { id: m.id, caption: m.caption || '' };
  if (m.kind === 'drive') out.driveId = m.drive_id;
  else { out.mediaId = m.media_id; out.mediaType = m.media_type; }
  return out;
}

function getRowsForApp(app) {
  const rows = db.prepare('SELECT * FROM rows WHERE app = ? ORDER BY sort_order, id').all(app);
  const mediaStmt = db.prepare('SELECT * FROM row_media WHERE row_id = ? AND slot = ? ORDER BY sort_order, id');
  return rows.map(r => ({
    id: r.id,
    mediaKind: r.media_kind,
    visualStyle: r.visual_style,
    title: r.title,
    dur: r.dur,
    tool: r.tool,
    dateGroup: r.date_group,
    inputDesc: r.input_desc,
    comment: r.comment,
    reference: mediaStmt.all(r.id, 'reference').map(mediaItemOut),
    result: mediaStmt.all(r.id, 'result').map(mediaItemOut)
  }));
}

function getNotesMedia() {
  return db.prepare('SELECT * FROM notes_media ORDER BY sort_order, id').all().map(mediaItemOut);
}

function getSwState() {
  const rows = db.prepare('SELECT * FROM sw_state').all();
  const out = {};
  rows.forEach(r => { out[r.group_key] = { good: r.good_html, bad: r.bad_html }; });
  return out;
}

function getUiState() {
  const row = db.prepare('SELECT * FROM ui_state WHERE id = 1').get();
  if (!row) return { collapsed: {}, texts: {}, groupCollapsed: {} };
  return {
    collapsed: JSON.parse(row.collapsed_json || '{}'),
    texts: JSON.parse(row.texts_json || '{}'),
    groupCollapsed: JSON.parse(row.group_collapsed_json || '{}')
  };
}

function computePlanRows() {
  const bookwiseRows = getRowsForApp('bookwise');
  const soulieRows = getRowsForApp('soulie');
  const all = [
    ...soulieRows.map(r => ({ ...r, app: 'Soulie' })),
    ...bookwiseRows.map(r => ({ ...r, app: 'BookWise' }))
  ];
  const map = new Map();
  all.forEach(r => {
    const key = (r.visualStyle || '(chưa đặt tên)') + '|' + r.app + '|' + r.mediaKind;
    if (!map.has(key)) {
      map.set(key, { visualStyle: r.visualStyle || '(chưa đặt tên)', app: r.app, mediaKind: r.mediaKind, count: 0, groups: new Set() });
    }
    const e = map.get(key);
    e.count++;
    e.groups.add(r.dateGroup);
  });
  return [...map.values()].map(e => ({
    visualStyle: e.visualStyle,
    app: e.app,
    mediaKind: e.mediaKind,
    count: e.count,
    groups: [...e.groups].map(g => (g === '1-14' ? '01–14/07' : g === '15-28' ? '15–28/07' : g)).join(', ')
  }));
}

function getFullState() {
  return {
    rows: { bookwise: getRowsForApp('bookwise'), soulie: getRowsForApp('soulie') },
    notesMedia: getNotesMedia(),
    planRows: computePlanRows(),
    swState: getSwState(),
    uiState: getUiState()
  };
}

module.exports = { getRowsForApp, getNotesMedia, getSwState, getUiState, computePlanRows, getFullState };
