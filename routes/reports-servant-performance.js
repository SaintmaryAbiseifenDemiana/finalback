const pool = require('../db');
const { getExpectedSessionsCount, getServicedCountForServant } = require('../helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'الطريقة غير مدعومة.' });
  }

  const familyId = req.query.family_id;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const startDate = ninetyDaysAgo.toISOString().split('T')[0];
  const maxSessions = getExpectedSessionsCount();

  try {
    let userSql = `
      SELECT u.user_id, u.username, f.family_name 
      FROM users u
      LEFT JOIN families f ON u.family_id = f.family_id
      WHERE u.role_group = 'Khadem' OR u.role_group = 'AmeenSekra'
    `;
    const params = [];

    if (familyId) {
      userSql += ' AND u.family_id = $1';
      params.push(familyId);
    }

    const servantsResult = await pool.query(userSql, params);
    const servants = servantsResult.rows;

    const report = [];

    for (const servant of servants) {
      const attendanceSql = `
        SELECT 
          COUNT(status) AS total_sessions,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
          SUM(lesson_prepared) AS lesson_prepared_count,
          SUM(communion) AS communion_count,
          SUM(confession) AS confession_count,
          SUM(visits_count) AS total_visits
        FROM servant_attendance 
        WHERE user_id = $1 AND session_date >= $2
      `;

      const dataResult = await pool.query(attendanceSql, [servant.user_id, startDate]);
      const data = dataResult.rows[0] || {};

      const denominator = maxSessions > 0 ? maxSessions : 1;

      const present_pct = ((data.present_count || 0) / denominator) * 100;
      const lesson_pct = ((data.lesson_prepared_count || 0) / denominator) * 100;
      const communion_pct = ((data.communion_count || 0) / denominator) * 100;
      const confession_pct = ((data.confession_count || 0) / denominator) * 100;

      const servicedCount = await getServicedCountForServant(servant.user_id);
      let visits_pct = 0;

      if (servicedCount > 0 && maxSessions > 0) {
        visits_pct = ((data.total_visits || 0) / (servicedCount * maxSessions)) * 100;
      }

      report.push({
        username: servant.username,
        family_name: servant.family_name || 'غير مسؤول',
        present_pct: present_pct.toFixed(1),
        lesson_pct: lesson_pct.toFixed(1),
        communion_pct: communion_pct.toFixed(1),
        confession_pct: confession_pct.toFixed(1),
        visits_pct: visits_pct.toFixed(1),
      });
    }

    return res.json({ success: true, report });

  } catch (err) {
    console.error('Error in servant performance report:', err.message);
    return res.status(500).json({ success: false, message: 'خطأ في قاعدة البيانات.' });
  }
};
