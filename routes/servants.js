const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ GET /api/servants/by-family/:familyId/:classId
// يرجع الخدام المرتبطين بفصل وأسرة معينة
router.get("/by-family/:familyId/:classId", async (req, res) => {
  const { familyId, classId } = req.params;

  try {
    const sql = `
      SELECT DISTINCT u.user_id, u.username
      FROM users u
      JOIN servant_serviced_link l ON u.user_id = l.servant_user_id
      JOIN serviced s ON l.serviced_id = s.serviced_id
      JOIN serviced_class_link scl ON s.serviced_id = scl.serviced_id
      JOIN classes c ON scl.class_id = c.class_id
      WHERE s.family_id = $1 AND c.class_id = $2
      ORDER BY u.username
    `;

    const result = await pool.query(sql, [familyId, classId]);

    return res.json({ success: true, servants: result.rows });

  } catch (err) {
    console.error("Error fetching servants:", err.message);
    return res.status(500).json({ success: false, message: "فشل جلب الخدام." });
  }
});

// ✅ GET /api/servants/by-family/:familyId
// يرجع كل الخدام التابعين لأسرة معينة
router.get("/by-family/:familyId", async (req, res) => {
  const { familyId } = req.params;

  try {
    const sql = `
      SELECT user_id, username, family_id
      FROM users
      WHERE role_group = 'Khadem' AND family_id = $1
      ORDER BY username ASC
    `;
    const result = await pool.query(sql, [familyId]);

    return res.json({
      success: true,
      servants: result.rows
    });

  } catch (err) {
    console.error("Error fetching servants by family:", err.message);
    return res.status(500).json({
      success: false,
      message: "فشل تحميل خدام الأسرة."
    });
  }
});

// ✅ GET /api/servants
// يرجع كل الخدام من كل الأسر
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
