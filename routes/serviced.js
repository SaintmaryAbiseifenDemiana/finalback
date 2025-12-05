const express = require("express");
const router = express.Router();
const pool = require("../db");
const { normalizeArabicFamilyName } = require("../helpers");

// ✅ GET /api/serviced/classes/:familyId
router.get("/classes/:familyId", async (req, res) => {
  const familyId = req.params.familyId;

  try {
    const sql = `
      SELECT DISTINCT class_name 
      FROM serviced 
      WHERE family_id = $1 
      ORDER BY class_name
    `;
    const result = await pool.query(sql, [familyId]);

    return res.json({
      success: true,
      classes: result.rows.map(r => r.class_name)
    });
  } catch (err) {
    console.error("SQL Error fetching classes:", err.message);
    return res.status(500).json({ success: false, message: "فشل جلب قائمة الفصول." });
  }
});

// ✅ GET /api/servants/by-family/:familyId/:className
router.get("/servants/by-family/:familyId/:className", async (req, res) => {
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

// ✅ GET /api/serviced/manage/:familyId/:className
router.get("/manage/:familyId/:className", async (req, res) => {
  const { familyId, className } = req.params;

  try {
    const sql = `
      SELECT 
        s.serviced_id, s.serviced_name, s.class_name,
        u.username AS servant_name, u.user_id AS servant_user_id
      FROM serviced s
      LEFT JOIN servant_serviced_link l ON s.serviced_id = l.serviced_id
      LEFT JOIN users u ON l.servant_user_id = u.user_id
      WHERE s.family_id = $1 AND s.class_name = $2
      ORDER BY s.serviced_name
    `;
    const result = await pool.query(sql, [familyId, className]);

    return res.json({ success: true, serviced: result.rows });
  } catch (err) {
    console.error("Error fetching serviced:", err.message);
    return res.status(500).json({ success: false, message: "فشل جلب المخدومين." });
  }
});

// ✅ POST /api/serviced
router.post("/", async (req, res) => {
  const { serviced_name, family_id, class_name, servant_user_id } = req.body || {};

  if (!serviced_name || !family_id || !class_name || !servant_user_id) {
    return res.status(400).json({ success: false, message: "كل البيانات مطلوبة." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertServiced = await client.query(
      `INSERT INTO serviced (serviced_name, family_id, class_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (serviced_name, family_id, class_name) DO NOTHING
       RETURNING serviced_id`,
      [serviced_name.trim(), family_id, class_name.trim()]
    );

    let serviced_id = insertServiced.rows[0]?.serviced_id;

    if (!serviced_id) {
      const existing = await client.query(
        `SELECT serviced_id FROM serviced WHERE serviced_name=$1 AND family_id=$2 AND class_name=$3`,
        [serviced_name.trim(), family_id, class_name.trim()]
      );
      serviced_id = existing.rows[0].serviced_id;
    }

    await client.query(
      `INSERT INTO servant_serviced_link (servant_user_id, serviced_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [servant_user_id, serviced_id]
    );

    await client.query("COMMIT");

    return res.json({ success: true, message: "✅ تم إضافة المخدوم وربطه بالخادم بنجاح." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error adding serviced:", err.message);
    return res.status(500).json({ success: false, message: "فشل إضافة المخدوم." });
  } finally {
    client.release();
  }
});

// ✅ DELETE /api/serviced/:id
router.delete("/:id", async (req, res) => {
  const serviced_id = req.params.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM serviced_attendance WHERE serviced_id = $1`, [serviced_id]);
    await client.query(`DELETE FROM servant_serviced_link WHERE serviced_id = $1`, [serviced_id]);
    await client.query(`DELETE FROM serviced WHERE serviced_id = $1`, [serviced_id]);

    await client.query("COMMIT");

    return res.json({ success: true, message: "✅ تم حذف المخدوم وكل سجلاته بنجاح." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting serviced:", err.message);
    return res.status(500).json({ success: false, message: "❌ فشل حذف المخدوم." });
  } finally {
    client.release();
  }
});

module.exports = router;
