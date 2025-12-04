const pool = require('../db');
const { getFridaysCount, getServicedCountForServant } = require('../helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'الطريقة غير مدعومة.' });
  }

  try {
    const { month, family_id } = req.query;
    const monthStr = (month || '').padStart(2, '0');

    const yearStr = ['10', '11', '12'].includes(monthStr) ? '2025' : '2026';

    let sql = `
      SELECT 
        u.user_id,
        u.username,
        SUM(m.meeting) AS meeting_sum,
        SUM(m.lesson) AS lesson_sum,
        SUM(m.communion) AS communion_sum,
        SUM(m.confession) AS confession_sum,
        SUM(m.visited_serviced) AS visited_sum
      FROM monthly_attendance m
      JOIN users u ON u.user_id = m.user_id
      WHERE EXTRACT(MONTH FROM m.date) = $1
        AND EXTRACT(YEAR FROM m.date) = $2
    `;

    let params = [parseInt(monthStr), parseInt(yearStr)];

    if (family_id) {
      sql += ' AND m.family_id = $3';
      params.push(family_id);
    }

    sql += ' GROUP BY u.user_id';

    const result = await pool.query(sql, params);
    const rows = result.rows;

    if (!rows || rows.length === 0) {
      return res.json({ success: true, report: [] });
    }

    const fridays = getFridaysCount(parseInt(yearStr), parseInt(monthStr));

    const report = await Promise.all(rows.map(async r => {
      const servantTotal = await getServicedCountForServant(r.user_id);

      return {
        username: r.username,
        meeting_pct: fridays > 0 ? ((r.meeting_sum || 0) / fridays * 100).toFixed(1) + '%' : '0%',
        lesson_pct: fridays > 0 ? ((r.lesson_sum || 0) / fridays * 100).toFixed(1) + '%' : '0%',
        communion_pct: fridays > 0 ? ((r.communion_sum || 0) / fridays * 100).toFixed(1) + '%' : '0%',
        confession_pct: fridays > 0 ? ((r.confession_sum || 0) / fridays * 100).toFixed(1) + '%' : '0%',
        visits_pct: (servantTotal > 0 && fridays > 0)
          ? ((r.visited_sum || 0) / (servantTotal * fridays) * 100).toFixed(1) + '%'
          : '0%'
      };
    }));

    return res.json({ success: true, report });

  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: 'خطأ أثناء تحميل التقرير' });
  }
};
