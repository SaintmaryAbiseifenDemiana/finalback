const express = require("express");
const router = express.Router();
const pool = require("../db");

// ======================================================
// ✅ GET /api/attendance/servants/:familyId
// (تحميل الخدام حسب الأسرة — المطلوب للفرونت)
// ======================================================
router.get("/servants/:familyId", async (req, res) => {
  const family_id = req.params.familyId;

  if (!family_id) {
    return res.status(400).json({ success: false, message: "رقم الأسرة مطلوب." });
  }

  try {
    const sql = `
      SELECT user_id, username, role_group
      FROM users 
      WHERE family_id = $1 AND role_group != 'Admin'
      ORDER BY username ASC
    `;
    const result = await pool.query(sql, [family_id]);

    return res.json({ success: true, servants: result.rows });
  } catch (err) {
    console.error("خطأ في جلب الخدام:", err.message);
    return res.status(500).json({ success: false, message: "فشل في جلب قائمة الخدام." });
  }
});

// ======================================================
// ✅ GET /api/attendance?servants=1&family_id=3
// (مسار قديم — ما زال مدعوم)
// ======================================================
router.get("/", async (req, res) => {
  if (req.query.servants) {
    const family_id = req.query.family_id;

    if (!family_id) {
      return res.status(400).json({ success: false, message: "رقم الأسرة مطلوب." });
    }

    try {
      const sql = `
        SELECT user_id, username, role_group
        FROM users 
        WHERE family_id = $1 AND role_group != 'Admin'
        ORDER BY username ASC
      `;
      const result = await pool.query(sql, [family_id]);
      return res.json({ success: true, servants: result.rows });
    } catch (err) {
      console.error("خطأ في جلب الخدام:", err.message);
      return res.status(500).json({ success: false, message: "فشل في جلب قائمة الخدام." });
    }
  }

  // ======================================================
  // ✅ GET /api/attendance?date=2025-01-01&family_id=3
  // (تحميل السجلات القديمة)
  // ======================================================
  const { date, family_id } = req.query;

  if (!date || !family_id) {
    return res.json({ success: false, message: "لازم تختاري تاريخ وأسرة" });
  }

  try {
    const sqlRecords = `
      SELECT user_id, family_id, session_date, status, absence_reason, apologized
      FROM servant_attendance
      WHERE session_date = $1 AND family_id = $2
    `;
    const recordsResult = await pool.query(sqlRecords, [date, family_id]);

    const sqlSummary = `
      SELECT attendees_count, recorded_by_user_id
      FROM family_attendance_summary
      WHERE session_date = $1 AND family_id = $2
      LIMIT 1
    `;
    const summaryResult = await pool.query(sqlSummary, [date, family_id]);

    return res.json({
      success: true,
      records: recordsResult.rows || [],
      summary: summaryResult.rows[0] || null
    });
  } catch (err) {
    console.error("خطأ في جلب سجلات الحضور:", err.message);
    return res.json({ success: false, message: "خطأ في قاعدة البيانات" });
  }
});

// ======================================================
// ✅ POST /api/attendance
// (تسجيل حضور الخدام)
// ======================================================
router.post("/", async (req, res) => {
  const { date, records, recorded_by_user_id, family_id, attendees_count } = req.body || {};

  if (!date || !records || !recorded_by_user_id || !family_id || attendees_count == null) {
    return res.status(400).json({
      success: false,
      message: "التاريخ، الأسرة، عدد المخدومين، سجلات الحضور، ومعرف المسجل مطلوبة."
    });
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: "سجلات الحضور غير صالحة أو فارغة." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let successCount = 0;

    for (const record of records) {
      const { user_id, status, absence_reason, apologized } = record;

      await client.query(
        `INSERT INTO servant_attendance 
         (user_id, family_id, session_date, status, absence_reason, apologized, recorded_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, session_date) DO UPDATE 
         SET status = EXCLUDED.status,
             absence_reason = EXCLUDED.absence_reason,
             apologized = EXCLUDED.apologized,
             recorded_by_user_id = EXCLUDED.recorded_by_user_id`,
        [user_id, family_id, date, status, absence_reason, apologized, recorded_by_user_id]
      );

      successCount++;
    }

    await client.query(
      `INSERT INTO family_attendance_summary 
       (family_id, session_date, attendees_count, recorded_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (family_id, session_date) DO UPDATE 
       SET attendees_count = EXCLUDED.attendees_count,
           recorded_by_user_id = EXCLUDED.recorded_by_user_id`,
      [family_id, date, attendees_count, recorded_by_user_id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: `تم تسجيل حضور/غياب ${successCount} خادم + عدد المخدومين (${attendees_count}) بتاريخ ${date} بنجاح.`
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("خطأ في حفظ السجلات:", err.message);
    return res.status(500).json({ success: false, message: "فشل حفظ السجلات بسبب خطأ في قاعدة البيانات." });
  } finally {
    client.release();
  }
});

module.exports = router;
