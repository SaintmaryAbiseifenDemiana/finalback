const pool = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'الطريقة غير مدعومة.' });
  }

  const { date, family_id, records } = req.body || {};

  if (!date || !family_id || !Array.isArray(records)) {
    return res.json({ success: false, message: 'بيانات ناقصة: لازم تاريخ وأسرة وسجلات' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const r of records) {
      await client.query(`
        INSERT INTO monthly_attendance 
        (user_id, family_id, date, meeting, lesson, communion, confession, total_serviced, visited_serviced)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, family_id, date) DO UPDATE SET
          meeting = EXCLUDED.meeting,
          lesson = EXCLUDED.lesson,
          communion = EXCLUDED.communion,
          confession = EXCLUDED.confession,
          total_serviced = EXCLUDED.total_serviced,
          visited_serviced = EXCLUDED.visited_serviced
      `, [
        r.user_id,
        family_id,
        date,
        r.meeting ? 1 : 0,
        r.lesson ? 1 : 0,
        r.communion ? 1 : 0,
        r.confession ? 1 : 0,
        r.total_serviced ?? 0,
        r.visited_serviced ?? 0
      ]);
    }

    await client.query('COMMIT');

    return res.json({ success: true, message: '✅ تم الحفظ بنجاح' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving monthly attendance:', err.message);
    return res.json({ success: false, message: '❌ خطأ في السيرفر أثناء الحفظ' });
  } finally {
    client.release();
  }
};
