const db = require('../config/db');

exports.getResult = (req, res) => {
  const student_id = req.session.user.id;
  const sql = `SELECT q.question_text, q.ideal_time_seconds, r.time_taken_seconds, r.selected_option, q.correct_option
               FROM responses r
               JOIN questions q ON r.question_id = q.id
               WHERE r.student_id = ?`;
  db.query(sql, [student_id], (err, results) => {
    if (err) throw err;
    res.json(results);
  });
};