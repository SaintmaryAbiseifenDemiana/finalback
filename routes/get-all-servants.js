const pool = require("../db");

module.exports = async (req, res) => {
  try {
    const sql = `
      SELECT user_id, username, family_id, class_name
      FROM users
      WHERE role_group IN ('servant', 'secretary')
      ORDER BY username
    `;

    const result = await pool.query(sql);

    return res.json({
      success: true,
      servants: result.rows
    });

  } catch (err) {
    console.error("Error fetching all servants:", err.message);
    return res.status(500).json({
      success: false,
      message: "فشل في تحميل الخدام."
    });
  }
};
