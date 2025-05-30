const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const router = express.Router();

// Middleware JWT
router.use((req, res, next) => {
  const auth = req.header('Authorization') || '';
  const token = auth.startsWith('Bearer ') && auth.slice(7);
  if (!token) return res.status(401).json({ message: 'Brak tokenu autoryzacyjnego' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Nieprawidłowy token' });
  }
});

// GET /api/me/credits
router.get('/credits', async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT u.first_name,
              p.name               AS package,
              up.remaining_credits AS remaining
       FROM user_packages up
       JOIN packages p ON up.package_id = p.id
       JOIN users u    ON u.id = up.user_id
       WHERE up.user_id = ?
       ORDER BY up.assigned_at DESC
       LIMIT 1`,
      [userId]
    );
    if (!rows.length) {
      const [[user]] = await pool.query(
        `SELECT first_name FROM users WHERE id = ?`,
        [userId]
      );
      return res.json({ first_name: user.first_name, package: null, remaining: 0 });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ ME /credits ERROR:', err);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania kredytów' });
  }
});

// GET /api/me/history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT \`change\`, type, timestamp
       FROM credit_history
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT 50`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ ME /history ERROR:', err);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania historii' });
  }
});

// POST /api/me/qr
// Generowanie kodu QR na podstawie userId, slotu i znacznika czasu
router.post('/qr', async (req, res) => {
  const userId = req.user.id;
  const minutes = Number(req.body.minutes);
  if (![30, 60].includes(minutes)) {
    return res.status(400).json({ message: 'Nieprawidłowy slot czasowy' });
  }
  // Prosty payload w base64 (możesz tu stosować JWT lub inny format)
  const payload = { userId, minutes, ts: Date.now() };
  const code = Buffer.from(JSON.stringify(payload)).toString('base64');
  res.json({ code });
});

module.exports = router;
