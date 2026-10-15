const express = require('express');
const path = require('node:path');
const { createApiRouter } = require('./api.cjs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use('/api', createApiRouter());

app.use('/tessdata', express.static(path.resolve(__dirname, '../public/tessdata')));

const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
