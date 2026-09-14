const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/items
app.get('/api/items', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve items.' });
  }
});

// POST /api/items
app.post('/api/items', (req, res) => {
  const { title, description } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ success: false, error: 'Title is required.' });
  }

  try {
    const stmt = db.prepare('INSERT INTO items (title, description) VALUES (?, ?)');
    const info = stmt.run(title.trim(), description ? description.trim() : '');
    const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ success: false, error: 'Failed to create item.' });
  }
});

// DELETE /api/items/:id
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM items WHERE id = ?');
    const info = stmt.run(id);

    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    res.json({ success: true, message: 'Item deleted successfully.' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete item.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});