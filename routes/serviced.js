const express = require("express");
const router = express.Router();
const pool = require("../db");

/* ============================================================
   ✅ 1) GET /api/serviced/classes/:familyId
   ============================================================ */
router.get("/classes/:familyId", async (req, res) => {
  const { familyId } = req.params;

  try {
    const sql = `
      SELECT class_id, class_name
      FROM classes
      WHERE family_id = $1
      ORDER BY class_name
    `;
    const result = await pool.query(sql, [familyId]);

    return res.json({
      success: true,
      classes: result.rows
    });
  } catch (err) {
    console.error("SQL Error fetching classes:", err.message);
    return res.status(500).json({
      success: false,
      message: "فشل جلب قائمة الفصول."
    });
  }
});

/* ============================================================
   ✅ 2) GET /api/serviced/by-class/:familyId/:classId
   (جلب المخدومين + حالة الحضور)
   ============================================================ */
router.get("/by-class/:familyId/:classId", async (req, res) => {
  const { familyId, classId } = req.params;
  const date = req.query.date; // ✅ مهم جدًا

  try {
    const sql = `
      SELECT 
        s.serviced_id,
        s.serviced_name,
        c.class_name,
        u.username AS servant_name,
        u.user_id AS servant_user_id,
        sa.status AS attendance_status
      FROM serviced s
      INNER JOIN serviced_class_link scl
        ON s.serviced_id = scl.serviced_id
      INNER JOIN classes c
        ON scl.class_id = c.class_id
      LEFT JOIN servant_serviced_link l
        ON s.serviced_id = l.serviced_id
      LEFT JOIN users u
        ON l.servant_user_id = u.user_id
      LEFT JOIN serviced_attendance sa
        ON sa.serviced_id = s.serviced_id
        AND sa.session_date = $3
      WHERE c.family_id = $1
        AND c.class_id = $2
      ORDER BY s.serviced_name;
    `;

    const result = await pool.query(sql, [familyId, classId, date]);

    return res.json({
      success: true,
      serviced: result.rows
    });

  } catch (err) {
    console.error("Error fetching serviced by class:", err.message);
    return res.status(500).json({
      success: false,
      message: "فشل جلب المخدومين."
    });
  }
});

/* ============================================================
   ✅ 3) POST /api/serviced
   ============================================================ */
router.post("/", async (req, res) => {
   console.log("📌 Received body:", req.body); // ✅ أهم إضافة
  const { serviced_name, family_id, class_id, servant_user_id } = req.body || {};

  if (!serviced_name || !family_id || !class_id || !servant_user_id) {
    return res.status(400).json({
      success: false,
      message: "كل البيانات مطلوبة."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertServiced = await client.query(
      `INSERT INTO serviced (serviced_name, family_id)
       VALUES ($1, $2)
       ON CONFLICT (serviced_name, family_id) DO NOTHING
       RETURNING serviced_id`,
      [serviced_name.trim(), family_id]
    );

    let serviced_id = insertServiced.rows[0]?.serviced_id;

    if (!serviced_id) {
      const existing = await client.query(
        `SELECT serviced_id 
         FROM serviced 
         WHERE serviced_name = $1 AND family_id = $2`,
        [serviced_name.trim(), family_id]
      );
      serviced_id = existing.rows[0].serviced_id;
    }

    await client.query(
      `INSERT INTO serviced_class_link (serviced_id, class_id)
       VALUES ($1, $2)
       ON CONFLICT (serviced_id, class_id) DO NOTHING`,
      [serviced_id, class_id]
    );

    await client.query(
      `INSERT INTO servant_serviced_link (servant_user_id, serviced_id)
       VALUES ($1, $2)
       ON CONFLICT (servant_user_id, serviced_id) DO NOTHING`,
      [servant_user_id, serviced_id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "✅ تم إضافة المخدوم وربطه بالفصل والخادم بنجاح."
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error adding serviced:", err.message);
    return res.status(500).json({
      success: false,
      message: "فشل إضافة المخدوم."
    });
  } finally {
    client.release();
  }
});

/* ============================================================
   ✅ 4) DELETE /api/serviced/:id
   ============================================================ */
router.delete("/:id", async (req, res) => {
  const serviced_id = req.params.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM serviced_attendance WHERE serviced_id = $1`, [serviced_id]);
    await client.query(`DELETE FROM servant_serviced_link WHERE serviced_id = $1`, [serviced_id]);
    await client.query(`DELETE FROM serviced_class_link WHERE serviced_id = $1`, [serviced_id]);
    await client.query(`DELETE FROM serviced WHERE serviced_id = $1`, [serviced_id]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "✅ تم حذف المخدوم وكل سجلاته بنجاح."
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting serviced:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ فشل حذف المخدوم."
    });
  } finally {
    client.release();
  }
});

/* ============================================================
   ✅ 5) Bulk Delete
   ============================================================ */
router.post("/bulk-delete", async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: "لم يتم اختيار أي مخدومين للحذف."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM serviced_attendance WHERE serviced_id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM servant_serviced_link WHERE serviced_id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM serviced_class_link WHERE serviced_id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM serviced WHERE serviced_id = ANY($1)`, [ids]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "✅ تم حذف المخدومين المحددين بنجاح."
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Bulk delete error:", err.message);
    return res.status(500).json({
      success: false,
      message: "❌ فشل حذف المخدومين."
    });
  } finally {
    client.release();
  }
});

/* ============================================================
   ✅ 6) POST /api/serviced/attendance
   ============================================================ */
router.post("/attendance", async (req, res) => {
  const { date, records, recorded_by_user_id } = req.body;

  if (!date || !records || !recorded_by_user_id) {
    return res.status(400).json({
      success: false,
      message: "البيانات غير مكتملة."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const rec of records) {
      await client.query(
        `INSERT INTO serviced_attendance (serviced_id, session_date, status, recorded_by_user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (serviced_id, session_date)
         DO UPDATE SET status = EXCLUDED.status, recorded_by_user_id = EXCLUDED.recorded_by_user_id`,
        [rec.serviced_id, date, rec.status, recorded_by_user_id]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "✅ تم حفظ حضور المخدومين بنجاح."
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving serviced attendance:", err.message);
    return res.status(500).json({
      success: false,
      message: "فشل حفظ حضور المخدومين."
    });
  } finally {
    client.release();
  }
});

module.exports = router;
