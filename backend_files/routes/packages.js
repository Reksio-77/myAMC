const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/packages
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, credits_included FROM packages'
    );
    res.json(rows);
  } catch (err) {
    console.error('❌ PACKAGES GET ERROR:', err);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania pakietów' });
  }
});

module.exports = router;
