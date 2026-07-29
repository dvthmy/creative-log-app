const { query } = require('./db');

function mediaItemOut(m) {
  const out = { id: m.id, caption: m.caption || '' };
  if (m.kind === 'drive') out.driveId = m.drive_id;
  else { out.mediaId = m.media_id; out.mediaType = m.media_type; }
  return out;
}

async function getRowsForApp(app) {
  const { rows } = await query('SELECT * FROM rows WHERE app = $1 ORDER BY sort_order, id', [app]);
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const { rows: mediaRows } = await query(
    'SELECT * FROM row_media WHERE row_id = ANY($1::int[]) ORDER BY sort_order, id', [ids]
  );
  const byKey = new Map();
  mediaRows.forEach(m => {
    const key = m.row_id + '|' + m.slot;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(mediaItemOut(m));
  });
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
    reference: byKey.get(r.id + '|reference') || [],
    result: byKey.get(r.id + '|result') || []
  }));
}

async function getNotesMedia() {
  const { rows } = await query('SELECT * FROM notes_media ORDER BY sort_order, id');
  return rows.map(mediaItemOut);
}

async function getSwState() {
  const { rows } = await query('SELECT * FROM sw_state');
  const out = {};
  rows.forEach(r => { out[r.group_key] = { good: r.good_html, bad: r.bad_html }; });
  return out;
}

async function getUiState() {
  const { rows } = await query('SELECT * FROM ui_state WHERE id = 1');
  const row = rows[0];
  if (!row) return { collapsed: {}, texts: {}, groupCollapsed: {} };
  return {
    collapsed: JSON.parse(row.collapsed_json || '{}'),
    texts: JSON.parse(row.texts_json || '{}'),
    groupCollapsed: JSON.parse(row.group_collapsed_json || '{}')
  };
}

async function computePlanRows() {
  const [bookwiseRows, soulieRows] = await Promise.all([getRowsForApp('bookwise'), getRowsForApp('soulie')]);
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

async function getFullState() {
  const [bookwise, soulie, notesMedia, planRows, swState, uiState] = await Promise.all([
    getRowsForApp('bookwise'),
    getRowsForApp('soulie'),
    getNotesMedia(),
    computePlanRows(),
    getSwState(),
    getUiState()
  ]);
  return { rows: { bookwise, soulie }, notesMedia, planRows, swState, uiState };
}

module.exports = { getRowsForApp, getNotesMedia, getSwState, getUiState, computePlanRows, getFullState };
