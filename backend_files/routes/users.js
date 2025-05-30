const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/users?role=member
// Zwraca listę użytkowników z rolą member wraz z datą utworzenia i aktualnymi kredytami
router.get('/', async (req, res) => {
  const role = req.query.role || 'member';
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at,
        COALESCE(up.remaining_credits, 0) AS credits
      FROM users u
      LEFT JOIN (
        SELECT user_id, remaining_credits
        FROM user_packages
        WHERE (user_id, assigned_at) IN (
          SELECT user_id, MAX(assigned_at) 
          FROM user_packages 
          GROUP BY user_id
        )
      ) up ON up.user_id = u.id
      WHERE u.role = ?
      ORDER BY u.created_at DESC
    `, [role]);
    res.json(rows);
  } catch (err) {
    console.error('❌ USERS GET ERROR:', err);
    res.status(500).json({ message: 'Błąd serwera podczas pobierania użytkowników' });
  }
});

// POST /api/users/:id/package
// Przydziela użytkownikowi nowy pakiet z automatycznym ustawieniem credits_included
router.post('/:id/package', async (req, res) => {
  const userId    = req.params.id;
  const { package_id } = req.body;
  try {
    // pobieramy domyślne kredyty dla pakietu
    const [[pkg]] = await pool.query(
      'SELECT credits_included FROM packages WHERE id = ?',
      [package_id]
    );
    if (!pkg) {
      return res.status(400).json({ message: 'Nie znaleziono pakietu' });
    }
    const creditsToAssign = pkg.credits_included;

    await pool.query(
      'INSERT INTO user_packages (user_id, package_id, remaining_credits, assigned_at) VALUES (?,?,?,NOW())',
      [userId, package_id, creditsToAssign]
    );
    res.json({ message: 'Pakiet przypisany pomyślnie', credits_assigned: creditsToAssign });
  } catch (err) {
    console.error('❌ USERS POST PACKAGE ERROR:', err);
    res.status(500).json({ message: 'Błąd serwera podczas przypisywania pakietu' });
  }
});

module.exports = router;
