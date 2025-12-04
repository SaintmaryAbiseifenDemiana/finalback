const pool = require('../db');
const { normalizeArabicFamilyName } = require('../helpers');

// ======================================================
// API: Serviced (المخدومين)
// ======================================================

module.exports = async (req, res) => {
  const method = req.method;

  // ✅ GET /api/serviced?classes=1&familyId=3
  if (method === 'GET' && req.query.classes) {
    const familyId = req.query.familyId;

    try {
      const sql = `
        SELECT DISTINCT class_name 
        FROM serviced 
        WHERE family_id = $1 
        ORDER BY class_name
      `;
      const result = await pool.query(sql, [familyId]);

      return res.json({
        success: true,
        classes: result.rows.map(r => r.class_name)
      });
    } catch (err) {
      console.error('SQL Error fetching classes:', err.message);
      return res.status(500).json({ success: false, message: 'فشل جلب قائمة الفصول.' });
    }
  }

  // ✅ GET /api/serviced?servants=1&familyId=3&className=KG1
  if (method === 'GET' && req.query.servants) {
    const { familyId, className } = req.query;

    try {
      const sql = `
        SELECT DISTINCT u.user_id, u.username
        FROM users u
        JOIN servant_serviced_link l ON u.user_id = l.servant_user_id
        JOIN serviced s ON l.serviced_id = s.serviced_id
        WHERE s.family_id = $1 AND s.class_name = $2
        ORDER BY u.username
      `;
      const result = await pool.query(sql, [familyId, className]);

      return res.json({ success: true, servants: result.rows });
    } catch (err) {
      console.error('Error fetching servants:', err.message);
      return res.status(500).json({ success: false, message: 'فشل جلب الخدام.' });
    }
  }

  // ✅ GET /api/serviced?manage=1&familyId=3&className=KG1
  if (method === 'GET' && req.query.manage) {
    const { familyId, className } = req.query;

    try {
      const sql = `
        SELECT 
          s.serviced_id, s.serviced_name, s.class_name,
          u.username AS servant_name, u.user_id AS servant_user_id
        FROM serviced s
        LEFT JOIN servant_serviced_link l ON s.serviced_id = l.serviced_id
        LEFT JOIN users u ON l.servant_user_id = u.user_id
        WHERE s.family_id = $1 AND s.class_name = $2
        ORDER BY s.serviced_name
      `;
      const result = await pool.query(sql, [familyId, className]);

      return res.json({ success: true, serviced: result.rows });
    } catch (err) {
      console.error('Error fetching serviced:', err.message);
      return res.status(500).json({ success: false, message: 'فشل جلب المخدومين.' });
    }
  }

  // ✅ POST /api/serviced (إضافة مخدوم وربطه بخادم)
  if (method === 'POST') {
    const { serviced_name, family_id, class_name, servant_user_id } = req.body || {};

    if (!serviced_name || !family_id || !class_name || !servant_user_id) {
      return res.status(400).json({ success: false, message: 'كل البيانات مطلوبة.' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const insertServiced = await client.query(
        `INSERT INTO serviced (serviced_name, family_id, class_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (serviced_name, family_id, class_name) DO NOTHING
         RETURNING serviced_id`,
        [serviced_name.trim(), family_id, class_name.trim()]
      );

      let serviced_id = insertServiced.rows[0]?.serviced_id;

      if (!serviced_id) {
        const existing = await client.query(
          `SELECT serviced_id FROM serviced WHERE serviced_name=$1 AND family_id=$2 AND class_name=$3`,
          [serviced_name.trim(), family_id, class_name.trim()]
        );
        serviced_id = existing.rows[0].serviced_id;
      }

      await client.query(
        `INSERT INTO servant_serviced_link (servant_user_id, serviced_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [servant_user_id, serviced_id]
      );

      await client.query('COMMIT');

      return res.json({ success: true, message: '✅ تم إضافة المخدوم وربطه بالخادم بنجاح.' });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error adding serviced:', err.message);
      return res.status(500).json({ success: false, message: 'فشل إضافة المخدوم.' });
    } finally {
      client.release();
    }
  }

  // ✅ DELETE /api/serviced?id=55
  if (method === 'DELETE') {
    const serviced_id = req.query.id;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(`DELETE FROM serviced_attendance WHERE serviced_id = $1`, [serviced_id]);
      await client.query(`DELETE FROM servant_serviced_link WHERE serviced_id = $1`, [serviced_id]);
      await client.query(`DELETE FROM serviced WHERE serviced_id = $1`, [serviced_id]);

      await client.query("COMMIT");

      return res.json({ success: true, message: "✅ تم حذف المخدوم وكل سجلاته بنجاح." });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error deleting serviced:", err.message);
      return res.status(500).json({ success: false, message: "❌ فشل حذف المخدوم بسبب وجود سجلات مرتبطة." });
    } finally {
      client.release();
    }
  }

  // ✅ GET /api/serviced?search=1&name=مينا
  if (method === 'GET' && req.query.search) {
    const name = req.query.name;

    try {
      const sql = `
        SELECT 
          s.serviced_id, s.serviced_name, s.class_name,
          f.family_name, u.username AS servant_name
        FROM serviced s
        JOIN families f ON s.family_id = f.family_id
        LEFT JOIN servant_serviced_link l ON s.serviced_id = l.serviced_id
        LEFT JOIN users u ON l.servant_user_id = u.user_id
        WHERE s.serviced_name ILIKE '%' || $1 || '%'
      `;
      const result = await pool.query(sql, [name]);

      return res.json({ success: true, results: result.rows });

    } catch (err) {
      console.error('Error searching serviced:', err.message);
      return res.status(500).json({ success: false, message: 'فشل البحث.' });
    }
  }

  // ✅ GET /api/serviced?list=1&familyId=3&className=KG1&date=2025-01-01
  if (method === 'GET' && req.query.list) {
    const { familyId, className, date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'تاريخ الجلسة مطلوب.' });
    }

    try {
      const sql = `
        SELECT s.serviced_id, s.serviced_name,
               (
                   SELECT status 
                   FROM serviced_attendance sa 
                   WHERE sa.serviced_id = s.serviced_id 
                     AND sa.session_date = $1
                   ORDER BY sa.id DESC 
                   LIMIT 1
               ) AS attendance_status
        FROM serviced s
        WHERE s.family_id = $2 AND s.class_name = $3
        ORDER BY s.serviced_name
      `;
      const result = await pool.query(sql, [date, familyId, className]);

      return res.json({ success: true, serviced: result.rows });

    } catch (err) {
      console.error('SQL Error fetching serviced list:', err.message);
      return res.status(500).json({ success: false, message: 'فشل جلب قائمة المخدومين.' });
    }
  }

  // ✅ POST /api/serviced/attendance
  if (method === 'POST' && req.query.attendance) {
    const { date, records, recorded_by_user_id } = req.body || {};

    if (!date || !records || !recorded_by_user_id) {
      return res.status(400).json({ success: false, message: 'التاريخ، سجلات الحضور، ومعرف المسجل مطلوبة.' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      let successCount = 0;

      for (const record of records) {
        const { serviced_id, status } = record;

        await client.query(
          `INSERT INTO serviced_attendance (serviced_id, session_date, status, recorded_by_user_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (serviced_id, session_date) DO UPDATE 
           SET status = EXCLUDED.status,
               recorded_by_user_id = EXCLUDED.recorded_by_user_id`,
          [serviced_id, date, status, recorded_by_user_id]
        );

        successCount++;
      }

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: `✅ تم تسجيل حضور ${successCount} مخدوم بتاريخ ${date} بنجاح.`
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Serviced Attendance PG ERROR:', err.message);
      return res.status(500).json({ success: false, message: 'فشل حفظ سجلات الحضور.' });
    } finally {
      client.release();
    }
  }

  // ✅ GET /api/serviced?monthly=1&month=12&familyId=3
  if (method === 'GET' && req.query.monthly) {
    const { month, familyId } = req.query;

    try {
      const sql = `
        SELECT s.serviced_id, s.serviced_name, u.username AS servant_name,
               s.class_name, f.family_name,
               sa.session_date, sa.status
        FROM serviced s
        JOIN families f ON s.family_id = f.family_id
        JOIN servant_serviced_link ssl ON s.serviced_id = ssl.serviced_id
        JOIN users u ON ssl.servant_user_id = u.user_id
        LEFT JOIN serviced_attendance sa 
            ON sa.serviced_id = s.serviced_id 
            AND EXTRACT(MONTH FROM sa.session_date) = $1
        WHERE s.family_id = $2
        ORDER BY u.username, s.serviced_name, sa.session_date
      `;

      const result = await pool.query(sql, [month, familyId]);
      const rows = result.rows;

      const filteredRows = rows.filter(r => {
        if (!r.class_name || !r.family_name) return true;
        return normalizeArabicFamilyName(r.class_name).toLowerCase() !== normalizeArabicFamilyName(r.family_name).toLowerCase();
      });

      const grouped = {};
      filteredRows.forEach(r => {
        if (!grouped[r.serviced_id]) {
          grouped[r.serviced_id] = {
            serviced_name: r.serviced_name,
            servant_name: r.servant_name,
            class_name: r.class_name,
            sessions: []
          };
        }
        if (r.session_date) {
          grouped[r.serviced_id].sessions.push({
            date: r.session_date,
            status: r.status
          });
        }
      });

      return res.json({ success: true, serviced: Object.values(grouped) });

    } catch (err) {
      console.error('SQL Error fetching monthly serviced:', err.message);
      return res.status(500).json({ success: false, message: 'فشل جلب النسبة الشهرية.' });
    }
  }

  // ✅ أي طريقة غير مدعومة
  return res.status(405).json({
    success: false,
    message: 'الطريقة غير مدعومة.'
  });
};
