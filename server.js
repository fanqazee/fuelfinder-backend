// ================= IMPORTS =================
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ================= CONFIG =================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "mysecretkey";

// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
});

// ================= SERVE FRONTEND (FIXED) =================
app.use(express.static(path.join(__dirname, "frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ================= AUTH MIDDLEWARE =================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ================= REGISTER =================
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2)',
      [email, hashed]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// ================= LOGIN =================
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: "User not found" });

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match)
      return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign(
      { id: user.id },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });

  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// ================= REPORTS =================
app.get('/reports', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM reports ORDER BY created_at DESC'
  );
  res.json(result.rows);
});

app.post('/report', auth, async (req, res) => {
  const { station, price, lat, lng } = req.body;

  await pool.query(
    'INSERT INTO reports (station, price, lat, lng) VALUES ($1,$2,$3,$4)',
    [station, price, lat, lng]
  );

  res.json({ success: true });
});

// ================= NEAREST STATIONS =================
app.get('/nearest', async (req, res) => {
  const { lat, lng } = req.query;

  const result = await pool.query(`
    SELECT *,
    (6371 * acos(
      cos(radians($1)) *
      cos(radians(lat)) *
      cos(radians(lng) - radians($2)) +
      sin(radians($1)) *
      sin(radians(lat))
    )) AS distance
    FROM reports
    ORDER BY distance ASC
    LIMIT 5
  `, [lat, lng]);

  res.json(result.rows);
});

// ================= CHEAPEST =================
app.get('/cheapest', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM reports ORDER BY price ASC LIMIT 5'
  );
  res.json(result.rows);
});

// ================= FAVOURITES =================
app.post('/favourite', auth, async (req, res) => {
  const { station, price, lat, lng } = req.body;

  await pool.query(
    'INSERT INTO favourites (user_id, station, price, lat, lng) VALUES ($1,$2,$3,$4,$5)',
    [req.user.id, station, price, lat, lng]
  );

  res.json({ success: true });
});

app.get('/favourites', auth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM favourites WHERE user_id = $1',
    [req.user.id]
  );

  res.json(result.rows);
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});