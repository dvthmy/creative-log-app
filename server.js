const path = require('path');
const express = require('express');

const db = require('./db');
const { getFullState } = require('./serialize');
const { UPLOAD_DIR } = require('./upload');
const rowsRouter = require('./routes/rows');
const rowMediaRouter = require('./routes/rowMedia');
const notesRouter = require('./routes/notes');
const swRouter = require('./routes/sw');
const uiRouter = require('./routes/ui');
const weeksRouter = require('./routes/weeks');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/state', async (req, res, next) => {
  try { res.json(await getFullState()); } catch (e) { next(e); }
});

app.use('/api/rows', rowsRouter);
app.use('/api/row-media', rowMediaRouter);
app.use('/api/notes', notesRouter);
app.use('/api/sw', swRouter);
app.use('/api/ui', uiRouter);
app.use('/api/weeks', weeksRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Lỗi không xác định' });
});

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
db.ready
  .then(() => app.listen(PORT, () => console.log('Creative Experiment Log đang chạy tại port ' + PORT)))
  .catch(err => { console.error('Không khởi tạo được database:', err); process.exit(1); });
