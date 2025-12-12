const express = require("express");
const router = express.Router();
const pool = require("../db");
const { normalizeArabicUsername } = require("../helpers");

router.get("/", async (req, res) => {
  let { name } = req.query;

  if (!name || name.trim() === "") {
    return res.json({ success: false, message: "❌ لازم تكتبي اسم للبحث" });
  }

  name = normalizeArabicUsername(name);

  try {
    const sql = `
      SELECT 
        s.serviced_id,
        s.serviced_name,
        f.family_name,
        c.class_name,
        u.username AS servant_name
      FROM serviced s
      LEFT JOIN families f 
        ON s.family_id = f.family_id
      LEFT JOIN serviced_class_link scl
        ON s.serviced_id = scl.serviced_id
      LEFT JOIN classes c
        ON scl.class_id = c.class_id
      LEFT JOIN servant_serviced_link l
        ON s.serviced_id = l.serviced_id
      LEFT JOIN users u
        ON l.servant_user_id = u.user_id
      WHERE s.serviced_name ILIKE $1
      ORDER BY s.serviced_name ASC
    `;

    const result = await pool.query(sql, [`%${name}%`]);

    return res.json({ success: true, results: result.rows });

  } catch (err) {
    console.error("❌ SQL ERROR:", err);
    return res.json({ success: false, message: "❌ خطأ أثناء البحث" });
  }
});

module.exports = router;
