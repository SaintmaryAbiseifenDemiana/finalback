const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ دالة لتطبيع الأسماء العربية
function normalizeArabicFamilyName(name) {
  return name
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/* ============================================================
   ✅ GET /api/admin/monthly-serviced/:month/:familyId
   ============================================================ */
router.get("/:month/:familyId", async (req, res) => {
  const { month, familyId } = req.params;

  try {
    const sql = `
      SELECT 
        s.serviced_id,
        s.serviced_name,
        c.class_name,
        u.username AS servant_name,
        TO_CHAR(sa.session_date, 'YYYY-MM-DD') AS session_date,
        sa.status
      FROM serviced s
      JOIN serviced_class_link scl 
        ON s.serviced_id = scl.serviced_id
      JOIN classes c 
        ON scl.class_id = c.class_id
      JOIN families f 
        ON s.family_id = f.family_id
      LEFT JOIN servant_serviced_link ssl 
        ON s.serviced_id = ssl.serviced_id
      LEFT JOIN users u 
        ON ssl.servant_user_id = u.user_id
      LEFT JOIN serviced_attendance sa 
        ON sa.serviced_id = s.serviced_id
        AND EXTRACT(MONTH FROM sa.session_date) = $1::int
      WHERE s.family_id = $2
      ORDER BY u.username, s.serviced_name, sa.session_date
    `;

    const result = await pool.query(sql, [month, familyId]);
    const rows = result.rows;

    // ✅ فلترة: استبعاد أي فصل اسمه زي الأسرة
    const filteredRows = rows.filter(r => {
      if (!r.class_name || !r.family_name) return true;
      return normalizeArabicFamilyName(r.class_name).toLowerCase() !==
             normalizeArabicFamilyName(r.family_name).toLowerCase();
    });

    const grouped = {};
    filteredRows.forEach(r => {
      if (!grouped[r.serviced_id]) {
        grouped[r.serviced_id] = {
          serviced_name: r.serviced_name,
          servant_name: r.servant_name,
          class_name: r.class_name,
          sessions: []
        };
      }
      if (r.session_date) {
        grouped[r.serviced_id].sessions.push({
          date: r.session_date,
          status: r.status
        });
      }
    });

    res.json({ success: true, serviced: Object.values(grouped) });

  } catch (err) {
    console.error("SQL Error fetching monthly serviced:", err.message);
    res.status(500).json({ success: false, message: "فشل جلب النسبة الشهرية." });
  }
});

module.exports = router;
