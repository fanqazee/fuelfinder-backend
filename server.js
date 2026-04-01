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

// ================= SERVE FRONTEND =================
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// ================= TEST =================
app.get('/', (req, res) => {
  res.send("Fuel Finder API Running 🚀");
});

// ================= AUTH MIDDLEWARE =================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ================= REGISTER =================
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2)',
      [email, hashed]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
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

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ================= GET REPORTS =================
app.get('/reports', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reports ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ================= ADD REPORT =================
app.post('/report', auth, async (req, res) => {
  try {
    const { station, price, lat, lng } = req.body;

    if (!station || !price || !lat || !lng) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await pool.query(
      'INSERT INTO reports (station, price, lat, lng) VALUES ($1, $2, $3, $4)',
      [station, price, lat, lng]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add report" });
  }
});

// ================= DELETE REPORT =================
app.delete('/report/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'DELETE FROM reports WHERE id = $1',
      [id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// ================= SAVE FAVOURITE =================
app.post('/favourite', auth, async (req, res) => {
  try {
    const { station, price, lat, lng } = req.body;

    await pool.query(
      'INSERT INTO favourites (user_id, station, price, lat, lng) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, station, price, lat, lng]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save favourite" });
  }
});

// ================= GET FAVOURITES =================
app.get('/favourites', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM favourites WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch favourites" });
  }
});

// ================= DELETE FAVOURITE =================
app.delete('/favourite/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'DELETE FROM favourites WHERE id = $1',
      [id]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete favourite" });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});