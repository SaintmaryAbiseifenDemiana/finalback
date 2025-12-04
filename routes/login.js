const bcrypt = require('bcrypt');
const pool = require('../db');
const { normalizeArabicUsername } = require('../helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'الطريقة غير مدعومة. استخدم POST فقط.'
    });
  }

  let { username, password } = req.body || {};
  const normalizedInput = normalizeArabicUsername(username);

  try {
    const sql = `
      SELECT u.user_id, u.username, u.password_hash, u.role_group, u.family_id, f.family_name
      FROM users u
      LEFT JOIN families f ON u.family_id = f.family_id
    `;
    const result = await pool.query(sql);
    const users = result.rows || [];

    const user = users.find(
      (u) => normalizeArabicUsername(u.username) === normalizedInput
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة.'
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'اسم المستخدم أو كلمة المرور غير صحيحة.'
      });
    }

    return res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح.',
      user_id: user.user_id,
      role: user.role_group,
      family_id: user.family_id,
      family_name: user.family_name,
      username: user.username
    });
  } catch (err) {
    console.error('خطأ في قاعدة البيانات:', err.message);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ داخلي في الخادم.'
    });
  }
};
