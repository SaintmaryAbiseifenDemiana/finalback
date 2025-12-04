const pool = require('../db');

module.exports = async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    console.error('Database test error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
