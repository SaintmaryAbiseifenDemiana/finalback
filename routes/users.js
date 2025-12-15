const bcrypt = require('bcrypt');
const pool = require('../db');
const { normalizeArabicUsername } = require('../helpers');

module.exports = async (req, res) => {
  const method = req.method;

  // ✅ POST /api/users → إضافة مستخدم
  if (method === 'POST') {
    let { username, password, role_group, family_id } = req.body || {};
    username = normalizeArabicUsername(username);

    if (!username || !password || !role_group) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم، كلمة المرور، والصلاحية مطلوبة.' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const sql = `
        INSERT INTO users (username, password_hash, role_group, family_id) 
        VALUES ($1, $2, $3, $4) RETURNING user_id
      `;
      const result = await pool.query(sql, [username, hashedPassword, role_group, family_id || null]);

      return res.status(201).json({
        success: true,
        message: 'تم إضافة المستخدم بنجاح.',
        user_id: result.rows[0].user_id
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'اسم المستخدم موجود بالفعل.' });
      }
      console.error('Error inserting user:', err.message);
      return res.status(500).json({ success: false, message: 'فشل إضافة المستخدم.' });
    }
  }

  // ✅ GET /api/users → جلب المستخدمين
 // ✅ GET /api/users → جلب المستخدمين مع العدد اليدوي
if (method === 'GET') {
  const { family_id } = req.query;

  let sql = `
    SELECT 
      u.user_id, 
      u.username, 
      u.role_group, 
      u.family_id, 
      f.family_name,

      -- ✅ العدد النهائي: اليدوي لو موجود، وإلا الأوتوماتيك
      COALESCE(sm.manual_count, COUNT(link.serviced_id)) AS serviced_count

    FROM users u
    LEFT JOIN families f ON u.family_id = f.family_id
    LEFT JOIN servant_serviced_link link 
      ON u.user_id = link.servant_user_id

    -- ✅ جدول العدد اليدوي
    LEFT JOIN servant_manual_counts sm
      ON sm.servant_user_id = u.user_id
  `;

  const params = [];

  if (family_id) {
    sql += ' WHERE u.family_id = $1';
    params.push(family_id);
  }

  sql += `
    GROUP BY 
      u.user_id, 
      u.username, 
      u.role_group, 
      u.family_id, 
      f.family_name,
      sm.manual_count
    ORDER BY u.username
  `;

  try {
    const result = await pool.query(sql, params);
    return res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    return res.json({ success: false, message: 'خطأ في جلب الخدام' });
  }
}

  // ✅ DELETE /api/users/5 أو /api/users?id=5
  if (method === 'DELETE') {
    const id = req.query.id || req.url.split("/").pop();

    if (!id) {
      return res.status(400).json({ success: false, message: 'رقم المستخدم مطلوب.' });
    }

    if (id == 1) {
      return res.status(403).json({ success: false, message: 'لا يمكن حذف المستخدم الأساسي للنظام.' });
    }

    try {
      const sql = 'DELETE FROM users WHERE user_id = $1';
      const result = await pool.query(sql, [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'لم يتم العثور على المستخدم للحذف.' });
      }

      return res.json({ success: true, message: 'تم حذف المستخدم بنجاح.' });
    } catch (err) {
      console.error('Error deleting user:', err.message);
      return res.status(500).json({ success: false, message: 'فشل حذف المستخدم.' });
    }
  }

  // ✅ PATCH /api/users/bulk-delete → حذف جماعي
  if (method === 'PATCH') {
    const { user_ids } = req.body || {};

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.json({ success: false, message: '❌ لا يوجد خدام محددين للحذف.' });
    }

    const filteredIds = user_ids.filter(id => id != 1);

    if (filteredIds.length === 0) {
      return res.json({ success: false, message: '❌ لا يمكن حذف المستخدم الأساسي للنظام.' });
    }

    try {
      const sql = `DELETE FROM users WHERE user_id = ANY($1::int[])`;
      const result = await pool.query(sql, [filteredIds]);

      return res.json({ success: true, message: `✅ تم مسح ${result.rowCount} خادم.` });
    } catch (err) {
      console.error('خطأ في مسح الخدام:', err.message);
      return res.json({ success: false, message: 'فشل في مسح الخدام.' });
    }
  }

  return res.status(405).json({
    success: false,
    message: 'الطريقة غير مدعومة.'
  });
};
