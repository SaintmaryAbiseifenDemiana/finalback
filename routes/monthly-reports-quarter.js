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
    // الفترة المؤقتة: أكتوبر 2025 – فبراير 2026
    const months2025 = [10, 11, 12];
    const months2026 = [1, 2];

    try {
      // استعلام يغطي شهور 2025
      const result2025 = await pool.query(`
        SELECT u.user_id, u.username,
          SUM(m.meeting) AS meeting_sum,
          SUM(m.lesson) AS lesson_sum,
          SUM(m.communion) AS communion_sum,
          SUM(m.confession) AS confession_sum,
          SUM(m.visited_serviced) AS visited_sum,
          SUM(m.total_serviced) AS total_sum
        FROM users u
        LEFT JOIN monthly_attendance m 
          ON u.user_id = m.user_id
          AND EXTRACT(MONTH FROM m.date) = ANY($1::int[])
          AND EXTRACT(YEAR FROM m.date) = 2025
        ${family_id ? 'WHERE u.family_id = $2' : ''}
        GROUP BY u.user_id
      `, family_id ? [months2025, family_id] : [months2025]);

      // استعلام يغطي شهور 2026
      const result2026 = await pool.query(`
        SELECT u.user_id, u.username,
          SUM(m.meeting) AS meeting_sum,
          SUM(m.lesson) AS lesson_sum,
          SUM(m.communion) AS communion_sum,
          SUM(m.confession) AS confession_sum,
          SUM(m.visited_serviced) AS visited_sum,
          SUM(m.total_serviced) AS total_sum
        FROM users u
        LEFT JOIN monthly_attendance m 
          ON u.user_id = m.user_id
          AND EXTRACT(MONTH FROM m.date) = ANY($1::int[])
          AND EXTRACT(YEAR FROM m.date) = 2026
        ${family_id ? 'WHERE u.family_id = $2' : ''}
        GROUP BY u.user_id
      `, family_id ? [months2026, family_id] : [months2026]);

      // نجمع النتائج كلها في صف واحد لكل خادم
      const merged = {};
      [...result2025.rows, ...result2026.rows].forEach(r => {
        if (!merged[r.user_id]) {
          merged[r.user_id] = { ...r };
        } else {
          merged[r.user_id].meeting_sum += r.meeting_sum || 0;
          merged[r.user_id].lesson_sum += r.lesson_sum || 0;
          merged[r.user_id].communion_sum += r.communion_sum || 0;
          merged[r.user_id].confession_sum += r.confession_sum || 0;
          merged[r.user_id].visited_sum += r.visited_sum || 0;
          merged[r.user_id].total_sum += r.total_sum || 0;
        }
      });

      const rows = Object.values(merged);

      // نحسب عدد الجمعات في الخمس شهور
      let totalFridays = 0;
      [10, 11, 12].forEach(m => totalFridays += getFridaysCount(2025, m)); 
      [1, 2].forEach(m => totalFridays += getFridaysCount(2026, m));
      
      // نكمل الحساب بنفس الطريقة
      const report = await Promise.all(rows.map(async r => {
        const servantTotal = await getServicedCountForServant(r.user_id);
        return {
          username: r.username,
          meeting_pct: totalFridays > 0 ? ((r.meeting_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
          lesson_pct: totalFridays > 0 ? ((r.lesson_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
          communion_pct: totalFridays > 0 ? ((r.communion_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
          confession_pct: totalFridays > 0 ? ((r.confession_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
          visits_pct: (servantTotal > 0 && totalFridays > 0)
            ? ((r.visited_sum || 0) / (servantTotal * totalFridays) * 100).toFixed(1) + '%'
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
        SUM(m.visited_serviced) AS visited_sum,
        SUM(m.total_serviced) AS total_sum
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

    let totalFridays = 0;
    months.forEach(m => {
      totalFridays += getFridaysCount(year, m);
    });

    const report = await Promise.all(rows.map(async r => {
      const servantTotal = await getServicedCountForServant(r.user_id);
      return {
        username: r.username,
        meeting_pct: totalFridays > 0 ? ((r.meeting_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
        lesson_pct: totalFridays > 0 ? ((r.lesson_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
        communion_pct: totalFridays > 0 ? ((r.communion_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
        confession_pct: totalFridays > 0 ? ((r.confession_sum || 0) / totalFridays * 100).toFixed(1) + '%' : '0%',
        visits_pct: (servantTotal > 0 && totalFridays > 0)
          ? ((r.visited_sum || 0) / (servantTotal * totalFridays) * 100).toFixed(1) + '%'
          : '0%'
      };
    }));

    return res.json({ success: true, report });

  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: 'خطأ في الحساب' });
  }
};
