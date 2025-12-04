const pool = require('../db');

module.exports = async (req, res) => {
  const method = req.method;

  // ✅ POST /api/families (إضافة أسرة)
  if (method === 'POST') {
    const { family_name } = req.body || {};

    if (!family_name) {
      return res.status(400).json({ success: false, message: 'اسم الأسرة مطلوب.' });
    }

    try {
      const sql = 'INSERT INTO families (family_name) VALUES ($1) RETURNING family_id';
      const result = await pool.query(sql, [family_name]);

      return res.status(201).json({
        success: true,
        message: 'تم إضافة الأسرة بنجاح.',
        family_id: result.rows[0].family_id
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ success: false, message: 'هذه الأسرة موجودة بالفعل.' });
      }
      console.error('Error inserting family:', err.message);
      return res.status(500).json({ success: false, message: 'فشل إضافة الأسرة.' });
    }
  }

  // ✅ GET /api/families (جلب كل الأسر)
  if (method === 'GET') {
    try {
      const sql = 'SELECT family_id, family_name FROM families ORDER BY family_name ASC';
      const result = await pool.query(sql);
      return res.json({ success: true, families: result.rows });
    } catch (err) {
      console.error('Error fetching families:', err.message);
      return res.status(500).json({ success: false, message: 'فشل قراءة بيانات الأسر.' });
    }
  }

  // ✅ PUT /api/families?id=5 (تعديل اسم الأسرة)
  if (method === 'PUT') {
    const id = req.query.id;
    const { family_name } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, message: 'رقم الأسرة مطلوب.' });
    }

    if (!family_name) {
      return res.status(400).json({ success: false, message: 'الاسم الجديد للأسرة مطلوب.' });
    }

    try {
      const sql = 'UPDATE families SET family_name = $1 WHERE family_id = $2';
      const result = await pool.query(sql, [family_name, id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'لم يتم العثور على الأسرة للتعديل.' });
      }

      return res.json({ success: true, message: 'تم تعديل اسم الأسرة بنجاح.' });
    } catch (err) {
      console.error('Error updating family:', err.message);
      return res.status(500).json({ success: false, message: 'فشل تعديل الأسرة.' });
    }
  }

  // ✅ DELETE /api/families?id=5 (حذف أسرة)
  if (method === 'DELETE') {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({ success: false, message: 'رقم الأسرة مطلوب.' });
    }

    try {
      const sql = 'DELETE FROM families WHERE family_id = $1';
      const result = await pool.query(sql, [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'لم يتم العثور على الأسرة للحذف.' });
      }

      return res.json({ success: true, message: 'تم حذف الأسرة بنجاح.' });
    } catch (err) {
      console.error('Error deleting family:', err.message);
      return res.status(500).json({ success: false, message: 'فشل حذف الأسرة.' });
    }
  }

  // ✅ POST /api/families/bulk-delete (حذف جماعي)
  if (method === 'PATCH') {
    const { family_ids } = req.body || {};

    if (!family_ids || !Array.isArray(family_ids) || family_ids.length === 0) {
      return res.json({ success: false, message: '❌ لا يوجد أسر محددة للحذف.' });
    }

    const filteredIds = family_ids.filter(id => id != 1);

    if (filteredIds.length === 0) {
      return res.json({ success: false, message: '❌ لا يمكن حذف الأسرة الأساسية للنظام.' });
    }

    try {
      const sql = `DELETE FROM families WHERE family_id = ANY($1::int[])`;
      const result = await pool.query(sql, [filteredIds]);

      return res.json({ success: true, message: `✅ تم مسح ${result.rowCount} أسرة.` });
    } catch (err) {
      console.error('خطأ في مسح الأسر:', err.message);
      return res.json({ success: false, message: '❌ فشل في مسح الأسر.' });
    }
  }

  // ✅ أي طريقة غير مدعومة
  return res.status(405).json({
    success: false,
    message: 'الطريقة غير مدعومة.'
  });
};
