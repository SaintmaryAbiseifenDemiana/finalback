const pool = require('../db');

module.exports = async (req, res) => {
  const method = req.method;

  // ✅ GET /api/reports-attendance?month=12&family_id=3
  if (method === 'GET') {
    const { month, family_id } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'لازم تختاري الشهر.'
      });
    }

    try {
      // ============================
      // ✅ تقرير حضور الخدام
      // ============================
      let sqlServants = `
        SELECT 
          u.user_id, u.username, f.family_name,
          a.session_date, a.status, a.absence_reason, a.apologized
        FROM users u
        LEFT JOIN families f ON u.family_id = f.family_id
        LEFT JOIN servant_attendance a ON u.user_id = a.user_id
        WHERE u.role_group != 'Admin'
          AND a.session_date IS NOT NULL
          AND EXTRACT(MONTH FROM a.session_date) = $1
      `;

      let paramsServants = [month];

      if (family_id) {
        sqlServants += ' AND u.family_id = $2';
        paramsServants.push(family_id);
      }

      sqlServants += ' ORDER BY f.family_name, u.username, a.session_date';

      const servantResult = await pool.query(sqlServants, paramsServants);

      // ============================
      // ✅ ملخص عدد المخدومين
      // ============================
      let sqlSummary = `
        SELECT family_id, session_date, attendees_count
        FROM family_attendance_summary
        WHERE EXTRACT(MONTH FROM session_date) = $1
      `;

      let paramsSummary = [month];

      if (family_id) {
        sqlSummary += ' AND family_id = $2';
        paramsSummary.push(family_id);
      }

      sqlSummary += ' ORDER BY session_date';

      const summaryResult = await pool.query(sqlSummary, paramsSummary);

      // ============================
      // ✅ النتيجة النهائية
      // ============================
      return res.json({
        success: true,
        report: servantResult.rows,
        summary: summaryResult.rows
      });

    } catch (err) {
      console.error('خطأ في جلب تقرير الحضور:', err.message);
      return res.status(500).json({
        success: false,
        message: 'فشل في جلب تقرير الحضور.'
      });
    }
  }

  // ✅ أي طريقة غير GET
  return res.status(405).json({
    success: false,
    message: 'الطريقة غير مدعومة.'
  });
};
