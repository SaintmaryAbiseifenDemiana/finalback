const pool = require('./db');

function normalizeArabicUsername(input) {
  if (!input) return '';
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ؤئء]/g, 'ء');
}

function normalizeArabicFamilyName(input) {
  if (!input) return '';
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآا]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ة]/g, 'ه');
}

function getFridaysCount(year, month) {
  let count = 0;
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 5) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}

async function getServicedCountForServant(user_id) {
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT s.serviced_id) AS count
       FROM serviced s
       JOIN servant_serviced_link l ON s.serviced_id = l.serviced_id
       WHERE l.servant_user_id = $1`,
      [user_id]
    );
    return result.rows.length > 0 ? result.rows[0].count : 0;
  } catch (err) {
    console.error('Error fetching serviced count:', err.message);
    throw err;
  }
}

function getExpectedSessionsCount() {
  return 12;
}

module.exports = {
  normalizeArabicUsername,
  normalizeArabicFamilyName,
  getFridaysCount,
  getServicedCountForServant,
  getExpectedSessionsCount
};
