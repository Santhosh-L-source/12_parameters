// GET /student/hundred-days/my-score
// req.user must be set by parent app middleware with at minimum { id }
async function getMyScore(req, res) {
  try {
    const db = req.app.get('db');
    const studentId = req.user.id;

    const { rows: [score] } = await db.query(`
      SELECT s.awarded_mark, s.awarded_category, s.in_pep, s.in_hope_non_elite, s.in_hope_elite,
             s.last_calculated_at, s.last_list_publication_date
      FROM hundred_days_scores s
      WHERE s.student_id = $1
    `, [studentId]);

    if (!score) {
      return res.json({
        programme: 'Hundred Days Training',
        status: 'Not selected',
        awarded_mark: 0,
        awarded_category: 'Not selected',
        last_updated: null,
      });
    }

    return res.json({
      programme: 'Hundred Days Training',
      status: score.awarded_mark > 0 ? 'Selected' : 'Not selected',
      awarded_mark: score.awarded_mark,
      awarded_category: score.awarded_category,
      in_pep: score.in_pep,
      in_hope_non_elite: score.in_hope_non_elite,
      in_hope_elite: score.in_hope_elite,
      last_updated: score.last_list_publication_date,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getMyScore };
