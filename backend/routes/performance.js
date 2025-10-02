const express = require('express');
const router = express.Router();
const db = require('../config/db'); // your DB connection

router.get('/', async (req, res) => {
  const [rows] = await db.execute(`
    SELECT 
      r.student_id,
      COUNT(*) AS total_questions,
      SUM(r.selected_option = q.correct_option) AS correct_answers,
      AVG(ABS(r.time_taken - q.ideal_time)) AS avg_time_deviation,
      SUM((r.selected_option = q.correct_option) * 
          (1.0 / (1 + ABS(r.time_taken - q.ideal_time)))) AS performance_score
    FROM responses r
    JOIN questions q ON r.question_id = q.id
    GROUP BY r.student_id
    ORDER BY performance_score DESC
  `);
  res.json(rows);
});

module.exports = router;
