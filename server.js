const path = require('path');
const express = require('express');

const { getFullState } = require('./serialize');
const { UPLOAD_DIR } = require('./upload');
const rowsRouter = require('./routes/rows');
const rowMediaRouter = require('./routes/rowMedia');
const notesRouter = require('./routes/notes');
const planRouter = require('./routes/plan');
const swRouter = require('./routes/sw');
const uiRouter = require('./routes/ui');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/state', (req, res) => res.json(getFullState()));

app.use('/api/rows', rowsRouter);
app.use('/api/row-media', rowMediaRouter);
app.use('/api/notes', notesRouter);
app.use('/api/plan-rows', planRouter);
app.use('/api/sw', swRouter);
app.use('/api/ui', uiRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Lỗi không xác định' });
});

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Creative Experiment Log đang chạy tại port ' + PORT));
