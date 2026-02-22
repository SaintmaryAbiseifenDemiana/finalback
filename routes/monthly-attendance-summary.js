const pool = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'استخدمي GET فقط.' });
  }

  const { month } = req.query;

  if (!month) {
    return res.status(400).json({ success: false, message: 'لازم تبعتي month' });
  }

  // ✅ تحديد السنة حسب الشهر
  const year = ["10", "11", "12"].includes(month) ? 2025 : 2026;

  try {
    const sql = `
      SELECT f.family_id, f.family_name, ma.date, COUNT(ma.user_id) AS records_count
      FROM families f
      LEFT JOIN monthly_attendance ma 
        ON f.family_id = ma.family_id 
        AND EXTRACT(MONTH FROM ma.date) = $1 
        AND EXTRACT(YEAR FROM ma.date) = $2
      GROUP BY f.family_id, f.family_name, ma.date
      ORDER BY f.family_name, ma.date;
    `;

    const result = await pool.query(sql, [month, year]);

    const families = {};
    result.rows.forEach(r => {
      if (!families[r.family_id]) {
        families[r.family_id] = {
          family_name: r.family_name,
          records: []
        };
      }
      families[r.family_id].records.push({
        date: r.date,
        submitted: r.records_count > 0
      });
    });

    return res.json({ success: true, families: Object.values(families) });

  } catch (err) {
    console.error('خطأ في جلب ملخص الغياب:', err.message);
    return res.status(500).json({ success: false, message: 'فشل في جلب الملخص.' });
  }
};
