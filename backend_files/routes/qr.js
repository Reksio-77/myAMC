const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const router = express.Router();

// Middleware JWT (jak w innych trasach)
router.use((req, res, next) => {
  const auth = req.header('Authorization')||'';
  const token = auth.startsWith('Bearer ')? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Brak tokenu' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Nieprawidłowy token' });
  }
});

// POST /api/qr/scan
router.post('/scan', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ message: 'Brak kodu QR' });
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(code, 'base64').toString());
  } catch {
    return res.status(400).json({ message: 'Nieprawidłowy format kodu QR' });
  }

  const { userId, minutes } = payload;
  const cost = minutes === 30 ? 1
             : minutes === 60 ? 2
             : null;
  if (!cost) {
    return res.status(400).json({ message: 'Nieprawidłowy slot czasowy' });
  }

  try {
    // Odejmujemy kredyty od konkretnego userId
    const [result] = await pool.query(
      `UPDATE user_packages
         SET remaining_credits = remaining_credits - ?
       WHERE user_id = ? AND remaining_credits >= ?`,
      [cost, userId, cost]
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'Brak wystarczającej liczby kredytów' });
    }

    // Zapisujemy historię
    await pool.query(
      'INSERT INTO credit_history (user_id, `change`, type, timestamp) VALUES (?,?,?,NOW())',
      [userId, -cost, 'usage']
    );

    return res.json({ message: `Zużyto ${cost} kredyt${cost > 1 ? 'y' : ''}` });
  } catch (err) {
    console.error('❌ QR/scan ERROR:', err);
    return res.status(500).json({ message: 'Błąd serwera podczas skanowania QR' });
  }
});

module.exports = router;
