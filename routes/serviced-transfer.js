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
    // ✅ 1) نجيب family_id بتاع الخادم الجديد
    const servantInfo = await pool.query(
      `SELECT family_id FROM users WHERE user_id = $1 AND role_group = 'Khadem'`,
      [new_servant_id]
    );

    if (servantInfo.rows.length === 0) {
      return res.json({ success: false, message: "❌ الخادم غير موجود" });
    }

    const { family_id } = servantInfo.rows[0];

    // ✅ 2) نجيب class_id بتاع المخدوم
    const classInfo = await pool.query(
      `SELECT class_id FROM serviced_class_link WHERE serviced_id = $1`,
      [serviced_id]
    );

    if (classInfo.rows.length === 0) {
      return res.json({ success: false, message: "❌ المخدوم ليس له فصل" });
    }

    const { class_id } = classInfo.rows[0];

    // ✅ 3) نحدّث جدول serviced (تغيير الأسرة فقط)
    await pool.query(
      `UPDATE serviced 
       SET family_id = $1
       WHERE serviced_id = $2`,
      [family_id, serviced_id]
    );

    // ✅ 4) نحدّث جدول الربط بالخادم
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
