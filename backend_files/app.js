require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const pool       = require('./db');
const authRoutes     = require('./routes/auth');
const usersRoutes    = require('./routes/users');
const packagesRoutes = require('./routes/packages');
const meRoutes       = require('./routes/me');
const qrRoutes       = require('./routes/qr');

const app = express();

// JSON body parser
app.use(bodyParser.json());

// Test połączenia z bazą
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✔️ Połączono z MariaDB');
    conn.release();
  } catch (err) {
    console.error('❌ Błąd połączenia z bazą:', err);
  }
})();

// Ping do testów TLS
app.get('/api/ping', (req, res) => res.send('pong'));

// No‐cache
app.use((req, res, next) => {
  res.set('Cache-Control','no-store, max-age=0');
  res.set('Pragma','no-cache');
  next();
});

// CORS – pozwalamy na member.axemateclub.pl i admin.axemateclub.pl, oraz brak Origin
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const host = new URL(origin).hostname;
      if (host === 'member.axemateclub.pl' || host === 'admin.axemateclub.pl') {
        return callback(null, true);
      }
    } catch {}
    callback(new Error('Nieautoryzowany origin'));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 200
}));
app.options('*', cors());

// Montowanie routerów
app.use('/api/auth',     authRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/me',       meRoutes);
app.use('/api/qr',       qrRoutes);

// Start serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend uruchomiony na porcie ${PORT}`);
});
