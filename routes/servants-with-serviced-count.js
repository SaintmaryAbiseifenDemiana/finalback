const pool = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'الطريقة غير مدعومة.' });
  }

  try {
    const sql = `
      SELECT 
        u.user_id,
        u.username,

        -- ✅ العدد النهائي: اليدوي لو موجود، وإلا الأوتوماتيك
        COALESCE(sm.manual_count, COUNT(link.serviced_id)) AS serviced_count

      FROM users u
      LEFT JOIN servant_serviced_link link 
        ON u.user_id = link.servant_user_id

      -- ✅ جدول العدد اليدوي
      LEFT JOIN servant_manual_counts sm
        ON sm.servant_user_id = u.user_id

      GROUP BY u.user_id, sm.manual_count
      ORDER BY u.username ASC
    `;

    const result = await pool.query(sql);

    return res.json({ success: true, users: result.rows });

  } catch (err) {
    console.error('خطأ في جلب عدد المخدومين:', err.message);
    return res.json({ success: false, message: 'خطأ في جلب عدد المخدومين' });
  }
};
