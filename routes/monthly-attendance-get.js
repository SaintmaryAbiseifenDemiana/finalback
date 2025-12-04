const pool = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'الطريقة غير مدعومة. استخدمي GET فقط.'
    });
  }

  const { date, family_id } = req.query;

  if (!date || !family_id) {
    return res.status(400).json({
      success: false,
      message: 'لازم تبعتي date و family_id'
    });
  }

  try {
    const sql = `
      SELECT ma.user_id, u.username, ma.family_id, ma.date,
             ma.meeting, ma.lesson, ma.communion, ma.confession,
             ma.total_serviced, ma.visited_serviced
      FROM monthly_attendance ma
      JOIN users u ON u.user_id = ma.user_id
      WHERE ma.date = $1 AND ma.family_id = $2
      ORDER BY u.username ASC
    `;

    const result = await pool.query(sql, [date, family_id]);

    return res.json({
      success: true,
      records: result.rows
    });

  } catch (err) {
    console.error('خطأ في جلب السجل الشهري:', err.message);
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب السجل الشهري.'
    });
  }
};
