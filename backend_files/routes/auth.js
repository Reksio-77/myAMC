const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const jwt     = require('jsonwebtoken');

// Rejestracja (bez zmian, tworzymy tylko memberów dalej)
router.post('/register', async (req, res) => {
  const { first_name, last_name, phone, email } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO users (first_name, last_name, phone, email, role) VALUES (?,?,?,?,?)',
      [ first_name, last_name, phone, email, 'member' ]
    );
    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('❌ REGISTER ERROR:', err);
    return res.status(500).json({ message: 'Błąd rejestracji' });
  }
});

// Logowanie
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // najpierw pobieramy id i rolę
    const [rows] = await pool.query(
      'SELECT id, role FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
    }
    const user = rows[0];

    // jeśli to admin, weryfikujemy hash w bazie
    if (user.role === 'admin') {
      const [[valid]] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM users WHERE id = ? AND password_hash = SHA2(?,256)',
        [user.id, password]
      );
      if (!valid.cnt) {
        return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      }
    }

    // generujemy token dla obu ról
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token });
  } catch (err) {
    console.error('❌ LOGIN ERROR:', err);
    return res.status(500).json({ message: 'Błąd bazy danych' });
  }
});

module.exports = router;
