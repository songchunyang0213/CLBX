const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

let db = null;
const memoryStore = new Map();

try {
  const { DatabaseSync } = require('node:sqlite');
  const dbDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'app.db');
  db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS app_kv (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
} catch (err) {
  console.warn('[Storage] SQLite initialization error, falling back to in-memory store:', err);
  db = null;
}

function createApiRouter() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/storage', (req, res) => {
    try {
      if (db) {
        const rows = db.prepare('SELECT key, value FROM app_kv').all();
        const obj = {};
        for (const row of rows) {
          obj[row.key] = row.value;
        }
        return res.json(obj);
      }
      const obj = {};
      for (const [k, v] of memoryStore.entries()) {
        obj[k] = v;
      }
      return res.json(obj);
    } catch (err) {
      console.error('Storage GET /storage error:', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/storage/:key', (req, res) => {
    try {
      const { key } = req.params;
      if (db) {
        const row = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(key);
        if (!row) return res.status(404).json({ error: 'Not found' });
        return res.json({ value: row.value });
      }
      if (!memoryStore.has(key)) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.json({ value: memoryStore.get(key) });
    } catch (err) {
      console.error('Storage GET /storage/:key error:', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.put('/storage/:key', (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const valStr = typeof value === 'string' ? value : JSON.stringify(value ?? '');

      if (db) {
        const stmt = db.prepare(`
          INSERT INTO app_kv (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);
        stmt.run(key, valStr);
      } else {
        memoryStore.set(key, valStr);
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('Storage PUT /storage/:key error:', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/storage/:key', (req, res) => {
    try {
      const { key } = req.params;
      if (db) {
        db.prepare('DELETE FROM app_kv WHERE key = ?').run(key);
      } else {
        memoryStore.delete(key);
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('Storage DELETE /storage/:key error:', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  return app;
}

module.exports = { createApiRouter };
