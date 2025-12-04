const pool = require('../db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const xlsx = require('xlsx');
const formidable = require('formidable');
const { normalizeArabicFamilyName } = require('../helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'الطريقة غير مدعومة. استخدم POST فقط.' });
  }

  const form = formidable({
    multiples: false,
    keepExtensions: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ success: false, message: 'خطأ في رفع الملف.' });
    }

    if (!files.servantFile) {
      return res.status(400).json({ success: false, message: 'لم يتم تحميل أي ملف.' });
    }

    const filePath = files.servantFile.filepath;

    try {
      // ✅ قراءة ملف Excel
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      fs.unlinkSync(filePath); // حذف الملف بعد القراءة

      if (data.length === 0) {
        return res.status(400).json({ success: false, message: 'الملف فارغ.' });
      }

      const requiredFields = ['username', 'password', 'family_name'];
      const validRecords = data.filter(r =>
        requiredFields.every(field => r[field])
      );

      if (validRecords.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'الملف لا يحتوي على سجلات صالحة (username, password, family_name).'
        });
      }

      const client = await pool.connect();
      let importedCount = 0;

      try {
        await client.query('BEGIN');

        for (const record of validRecords) {
          const username = String(record.username).trim();
          const password = String(record.password).trim();
          const role_group = String(record.role_group || 'Khadem').trim();
          const family_name = normalizeArabicFamilyName(String(record.family_name).trim());

          // ✅ إضافة الأسرة لو مش موجودة
          await client.query(
            `INSERT INTO families (family_name) VALUES ($1)
             ON CONFLICT (family_name) DO NOTHING`,
            [family_name]
          );

          const famResult = await client.query(
            `SELECT family_id FROM families WHERE family_name = $1`,
            [family_name]
          );

          const family_id = famResult.rows[0].family_id;
          const hashedPassword = await bcrypt.hash(password, 10);

          const userResult = await client.query(
            `INSERT INTO users (username, password_hash, role_group, family_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (username) DO NOTHING
             RETURNING user_id`,
            [username, hashedPassword, role_group, family_id]
          );

          if (userResult.rows.length > 0) {
            importedCount++;
          }
        }

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: `✅ تم استيراد ${importedCount} خادم.`,
          importedCount
        });

      } catch (e) {
        await client.query('ROLLBACK');
        console.error('Import error:', e.message);
        return res.status(500).json({ success: false, message: 'خطأ أثناء الاستيراد.' });
      } finally {
        client.release();
      }

    } catch (e) {
      console.error('File read error:', e.message);
      return res.status(500).json({ success: false, message: 'خطأ في قراءة الملف.' });
    }
  });
};
