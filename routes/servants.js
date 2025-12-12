const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET /api/servants/by-family/:familyId/:className
router.get("/by-family/:familyId/:className", async (req, res) => {
  const { familyId, className } = req.params;

  try {
    const sql = `
      SELECT DISTINCT u.user_id, u.username
      FROM users u
      JOIN servant_serviced_link l ON u.user_id = l.servant_user_id
      JOIN serviced s ON l.serviced_id = s.serviced_id
      WHERE s.family_id = $1 AND s.class_name = $2
      ORDER BY u.username
    `;
    const result = await pool.query(sql, [familyId, className]);

    return res.json({ success: true, servants: result.rows });
  } catch (err) {
    console.error("Error fetching servants:", err.message);
    return res.status(500).json({ success: false, message: "فشل جلب الخدام." });
  }
});

// ✅ GET /api/servants  → يجيب كل الخدام الحقيقيين
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT user_id, username, family_id
      FROM users
      WHERE role_group = 'Khadem'
      ORDER BY username ASC
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
      message: "فشل تحميل الخدام."
    });
  }
});


module.exports = router;
