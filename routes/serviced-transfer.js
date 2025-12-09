const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ POST /api/serviced/transfer
router.post("/", async (req, res) => {
  const { serviced_id, new_servant_id } = req.body;

  if (!serviced_id || !new_servant_id) {
    return res.json({ success: false, message: "❌ بيانات غير مكتملة" });
  }

  try {
    // ✅ 1) نجيب بيانات الخادم الجديد
    const servantInfo = await pool.query(
      `SELECT family_id, class_name FROM servants WHERE user_id = $1`,
      [new_servant_id]
    );

    if (servantInfo.rows.length === 0) {
      return res.json({ success: false, message: "❌ الخادم غير موجود" });
    }

    const { family_id, class_name } = servantInfo.rows[0];

    // ✅ 2) نحدّث جدول serviced
    await pool.query(
      `UPDATE serviced 
       SET family_id = $1, class_name = $2 
       WHERE serviced_id = $3`,
      [family_id, class_name, serviced_id]
    );

    // ✅ 3) نحدّث جدول الربط
    await pool.query(
      `UPDATE servant_serviced_link
       SET servant_user_id = $1
       WHERE serviced_id = $2`,
      [new_servant_id, serviced_id]
    );

    return res.json({
      success: true,
      message: "✅ تم نقل المخدوم بنجاح",
    });

  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    return res.json({ success: false, message: "❌ خطأ أثناء النقل" });
  }
});

module.exports = router;
