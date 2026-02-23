const pool = require('../db');
const { getFridaysCount, getServicedCountForServant } = require('../helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'الطريقة غير مدعومة.' });
  }

  const { family_id, quarter } = req.query;

  let months = [];
  let year = null;

  if (quarter === 'Q1') { months = [10, 11, 12]; year = 2025; }
  else if (quarter === 'Q2') { months = [1, 2, 3]; year = 2026; }
  else if (quarter === 'Q3') { months = [4, 5, 6]; year = 2026; }
  else if (quarter === 'Q4') { months = [7, 8, 9]; year = 2026; }
  else if (quarter === 'TEMP') {
    // الفترة المؤقتة: أكتوبر 2025 – فبراير 2026 (5 شهور)
    const months = [10, 11, 12, 1, 2];
    try {
      const result = await pool.query(`
        SELECT u.user_id, u.username,
          SUM(m.meeting) AS meeting_sum,
          SUM(m.lesson) AS lesson_sum,
          SUM(m.communion) AS communion_sum,
          SUM(m.confession) AS confession_sum,
          SUM(m.visited_serviced) AS visited_sum
        FROM users u
        LEFT JOIN monthly_attendance m 
          ON u.user_id = m.user_id
          AND (
            (EXTRACT(MONTH FROM m.date) IN (10,11,12) AND EXTRACT(YEAR FROM m.date) = 2025)
            OR
            (EXTRACT(MONTH FROM m.date) IN (1,2) AND EXTRACT(YEAR FROM m.date) = 2026)
          )
        ${family_id ? 'WHERE u.family_id = $1' : ''}
        GROUP BY u.user_id
      `, family_id ? [family_id] : []);

      const rows = result.rows;

      // عدد الجمعات في الفترة (أكتوبر–فبراير)
      let totalFridays = 0;
      [10, 11, 12].forEach(m => totalFridays += getFridaysCount(2025, m));
      [1, 2].forEach(m => totalFridays += getFridaysCount(2026, m));

      // عدد الشهور في الفترة = 5
      const totalMonths = 5;

      const report = await Promise.all(rows.map(async r => {
        const servantTotal = await getServicedCountForServant(r.user_id);
        return {
          username: r.username,
          // الحضور على عدد الجمعات
          meeting_pct: totalFridays > 0 ? ((r.meeting_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
          lesson_pct: totalFridays > 0 ? ((r.lesson_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
          communion_pct: totalFridays > 0 ? ((r.communion_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
          // الاعتراف زي الافتقاد (عدد المخدومين × عدد الشهور)
          confession_pct: (servantTotal > 0 && totalMonths > 0)
            ? ((r.confession_sum || 0) / (servantTotal * totalMonths) * 100).toFixed(1) + '%'
            : '0%',
          // الافتقاد على عدد المخدومين × عدد الشهور
          visits_pct: (servantTotal > 0 && totalMonths > 0)
            ? ((r.visited_sum || 0) / (servantTotal * totalMonths) * 100).toFixed(1) + '%'
            : '0%'
        };
      }));

      return res.json({ success: true, report });

    } catch (err) {
      console.error(err);
      return res.json({ success: false, message: 'خطأ في الحساب المؤقت' });
    }
  } else {
    return res.json({ success: false, message: '❌ لازم تختاري ربع سنوي صحيح (Q1–Q4 أو TEMP)' });
  }

  // الكود الأصلي للأرباع (Q1–Q4)
  try {
    let sql = `
      SELECT 
        u.user_id,
        u.username,
        SUM(m.meeting) AS meeting_sum,
        SUM(m.lesson) AS lesson_sum,
        SUM(m.communion) AS communion_sum,
        SUM(m.confession) AS confession_sum,
        SUM(m.visited_serviced) AS visited_sum
      FROM users u
      LEFT JOIN monthly_attendance m 
        ON u.user_id = m.user_id
        AND EXTRACT(MONTH FROM m.date) = ANY($1::int[])
        AND EXTRACT(YEAR FROM m.date) = $2
    `;

    let params = [months, year];
    if (family_id) {
      sql += ' WHERE u.family_id = $3';
      params.push(family_id);
    }
    sql += ' GROUP BY u.user_id';

    const result = await pool.query(sql, params);
    const rows = result.rows;

    // عدد الجمعات في الربع
    let totalFridays = 0;
    months.forEach(m => {
      totalFridays += getFridaysCount(year, m);
    });

    // عدد الشهور في الربع = 3
    const totalMonths = 3;

    const report = await Promise.all(rows.map(async r => {
      const servantTotal = await getServicedCountForServant(r.user_id);
      return {
        username: r.username,
        // الحضور على عدد الجمعات
        meeting_pct: totalFridays > 0 ? ((r.meeting_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
        lesson_pct: totalFridays > 0 ? ((r.lesson_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
        communion_pct: totalFridays > 0 ? ((r.communion_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
        // الاعتراف زي الافتقاد (عدد المخدومين × عدد الشهور)
        confession_pct: (servantTotal > 0 && totalMonths > 0)
          ? ((r.confession_sum || 0) / (servantTotal * totalMonths) * 100).toFixed(1) + '%'
          : '0%',
        // الافتقاد على عدد المخدومين × عدد الشهور
        visits_pct: (servantTotal > 0 && totalMonths > 0)
          ? ((r.visited_sum || 0) / (servantTotal * totalMonths) * 100).toFixed(1) + '%'
          : '0%'
      };
    }));

    return res.json({ success: true, report });

  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: 'خطأ في الحساب' });
  }
};
