const pool = require('../db');

module.exports = async (req, res) => {
  const { name } = req.query;

  if (!name || name.trim() === "") {
    return res.json({ success: false, message: "❌ لازم تكتبي اسم للبحث" });
  }

  try {
    const sql = `
      SELECT 
        s.serviced_id,
        s.serviced_name,
        f.family_name,
        s.class_name,
        u.username AS servant_name
      FROM serviced s
      LEFT JOIN families f ON s.family_id = f.family_id
      LEFT JOIN servant_serviced_link l ON s.serviced_id = l.serviced_id
      LEFT JOIN users u ON l.servant_user_id = u.user_id
      WHERE s.serviced_name ILIKE $1
         OR s.serviced_name LIKE '%' || $1 || '%'
    `;

    const result = await pool.query(sql, [`%${name}%`]);

    return res.json({ success: true, results: result.rows });

  } catch (err) {
    console.error("❌ SQL ERROR:", err);
    return res.json({ success: false, message: "❌ خطأ أثناء البحث" });
  }
};
