const pool = require('../db');
const fs = require('fs');
const xlsx = require('xlsx');
const formidable = require('formidable');
const { normalizeArabicFamilyName, normalizeArabicUsername } = require('../helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'الطريقة غير مدعومة. استخدم POST فقط.'
    });
  }

  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).json({ success: false, message: 'خطأ في رفع الملف.' });
    }

    if (!files.servicedFile) {
      return res.status(400).json({ success: false, message: 'لم يتم تحميل أي ملف.' });
    }

    const uploadedPath =
      files.servicedFile.filepath ||
      files.servicedFile._writeStream?.path ||
      files.servicedFile._writeStream?._path;

    if (!uploadedPath) {
      return res.status(500).json({ success: false, message: "تعذر تحديد مسار الملف." });
    }

    try {
      const fileBuffer = fs.readFileSync(uploadedPath);

      const workbook = xlsx.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      if (data.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'الملف فارغ أو لا يحتوي على بيانات.'
        });
      }

      // ✅ تنظيف شامل
      const clean = (str) =>
        str?.toString().replace(/\s+/g, ' ').trim() || "";

      const cleaned = data.map(row => {
        const newRow = {};
        for (const key in row) {
          newRow[key.toString().trim().toLowerCase()] = clean(row[key]);
        }
        return newRow;
      });

      const required = ['serviced_name', 'family_name', 'servant_username', 'class_name'];
      const validRecords = cleaned.filter(r =>
        required.every(f => r[f] && r[f] !== '')
      );

      if (validRecords.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'لم يتم العثور على سجلات كاملة.'
        });
      }

      const client = await pool.connect();
      let importedCount = 0;
      let linkCount = 0;
      let classLinkCount = 0;

      try {
        await client.query('BEGIN');

        for (const record of validRecords) {
          const servicedName = clean(record.serviced_name);
          const familyName = normalizeArabicFamilyName(clean(record.family_name));
          const className = clean(record.class_name);
          const servantUsername = normalizeArabicUsername(clean(record.servant_username));

          // ✅ إضافة الأسرة لو مش موجودة
          await client.query(
            `INSERT INTO families (family_name)
             VALUES ($1)
             ON CONFLICT (family_name) DO NOTHING`,
            [familyName]
          );

          const famResult = await client.query(
            `SELECT family_id FROM families WHERE family_name = $1`,
            [familyName]
          );

          const family_id = famResult.rows[0].family_id;

          // ✅ البحث عن الخادم
          const usersResult = await client.query(`SELECT user_id, username FROM users`);
          const servantRow = usersResult.rows.find(
            u => normalizeArabicUsername(u.username) === servantUsername
          );

          if (!servantRow) {
            console.warn(`Servant not found: ${servantUsername}`);
            continue;
          }

          const servant_user_id = servantRow.user_id;

          // ✅ إضافة المخدوم مرة واحدة فقط
          const servicedInsert = await client.query(
            `INSERT INTO serviced (serviced_name)
             VALUES ($1)
             ON CONFLICT (serviced_name) DO NOTHING
             RETURNING serviced_id`,
            [servicedName]
          );

          let serviced_id;

          if (servicedInsert.rows.length > 0) {
            serviced_id = servicedInsert.rows[0].serviced_id;
            importedCount++;
          } else {
            const servicedResult = await client.query(
              `SELECT serviced_id FROM serviced WHERE serviced_name=$1`,
              [servicedName]
            );
            serviced_id = servicedResult.rows[0].serviced_id;
          }

          // ✅ ربط المخدوم بالخادم
          const linkResult = await client.query(
            `INSERT INTO servant_serviced_link (servant_user_id, serviced_id)
             VALUES ($1, $2)
             ON CONFLICT (servant_user_id, serviced_id) DO NOTHING
             RETURNING link_id`,
            [servant_user_id, serviced_id]
          );

          if (linkResult.rows.length > 0) linkCount++;

          // ✅ تسجيل الفصل لو class_name != family_name
          if (className !== familyName) {
            // ✅ إضافة الفصل لو مش موجود
            const classInsert = await client.query(
              `INSERT INTO classes (class_name, family_id)
               VALUES ($1, $2)
               ON CONFLICT (class_name, family_id) DO NOTHING
               RETURNING class_id`,
              [className, family_id]
            );

            let class_id;

            if (classInsert.rows.length > 0) {
              class_id = classInsert.rows[0].class_id;
            } else {
              const classResult = await client.query(
                `SELECT class_id FROM classes WHERE class_name=$1 AND family_id=$2`,
                [className, family_id]
              );
              class_id = classResult.rows[0].class_id;
            }

            // ✅ ربط المخدوم بالفصل
            const classLink = await client.query(
              `INSERT INTO serviced_class_link (serviced_id, class_id)
               VALUES ($1, $2)
               ON CONFLICT (serviced_id, class_id) DO NOTHING
               RETURNING id`,
              [serviced_id, class_id]
            );

            if (classLink.rows.length > 0) classLinkCount++;
          }
        }

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: `✅ تم استيراد ${importedCount} مخدوم وربط ${linkCount} خادم وربط ${classLinkCount} فصل بنجاح.`
        });

      } catch (e) {
        await client.query('ROLLBACK');
        console.error('Import serviced error:', e.message);
        return res.status(500).json({
          success: false,
          message: 'فشل في استيراد بعض السجلات. تم التراجع عن العملية.'
        });
      } finally {
        client.release();
      }

    } catch (e) {
      console.error('File read error:', e.message);
      return res.status(500).json({
        success: false,
        message: 'خطأ في قراءة الملف.'
      });
    }
  });
};
