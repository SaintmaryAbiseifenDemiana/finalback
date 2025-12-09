const pool = require("../db");

module.exports = async (req, res) => {
  try {
    const sql = `
      SELECT user_id, username, family_id
      FROM users
      WHERE role_group = 'servant'
      ORDER BY username ASC
    `;

    const result = await pool.query(sql);

    return res.json({
      success: true,
      servants: result.rows
    });

  } catch (err) {
    console.error("SERVANTS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "❌ خطأ أثناء تحميل الخدام"
    });
  }
};
