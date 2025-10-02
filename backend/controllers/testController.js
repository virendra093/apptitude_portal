const db = require("../config/db");
const path = require("path");

exports.getTest = (req, res) => {
  if (!req.session.user) return res.redirect("/auth/login");
  res.sendFile(path.join(__dirname, "../../frontend/views/test.html"));
};

exports.getQuestion = async (req, res) => {
  try {
    const student_id = req.session.user.id;

    // Get all questions that the user hasn't answered yet
    const [questions] = await db.promise().query(
      `
      SELECT q.*, 
             COALESCE(q.ideal_time, 60) as ideal_time 
      FROM questions q
      WHERE q.id NOT IN (
        SELECT question_id 
        FROM responses 
        WHERE student_id = ?
      )
      ORDER BY q.id ASC
      LIMIT 1
    `,
      [student_id]
    );

    if (questions.length > 0) {
      res.json(questions[0]);
    } else {
      // If user has answered all questions, get their total score
      const [results] = await db.promise().query(
        `
        SELECT 
          COUNT(*) as total_questions,
          SUM(is_correct) as correct_answers
        FROM responses 
        WHERE student_id = ?
      `,
        [student_id]
      );

      res.json({
        completed: true,
        total_questions: results[0].total_questions,
        correct_answers: results[0].correct_answers,
        score: (results[0].correct_answers / results[0].total_questions) * 100,
      });
    }
  } catch (err) {
    console.error("Error fetching question:", err);
    res.status(500).json({ error: "Failed to fetch question" });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const { question_id, selected_option, time_taken } = req.body;
    const student_id = req.session.user.id;

    // Get the correct answer and ideal time for the question
    const [question] = await db
      .promise()
      .query(
        "SELECT correct_option, COALESCE(ideal_time, 60) as ideal_time FROM questions WHERE id = ?",
        [question_id]
      );

    if (!question.length) {
      return res.status(404).json({ error: "Question not found" });
    }

    const is_correct = selected_option === question[0].correct_option;
    const ideal_time = question[0].ideal_time;

    // Insert the response
    await db
      .promise()
      .query(
        "INSERT INTO responses (student_id, question_id, selected_option, time_taken, is_correct) VALUES (?, ?, ?, ?, ?)",
        [student_id, question_id, selected_option, time_taken, is_correct]
      );

    // Record timing data for analysis
    try {
      await db
        .promise()
        .query("CALL insert_question_timing(?, ?, ?, ?)", [
          student_id,
          question_id,
          time_taken,
          ideal_time,
        ]);
    } catch (timingErr) {
      console.error("Error recording timing data:", timingErr);
      // Continue with the response even if timing recording fails
    }

    // Get the next question
    const [nextQuestion] = await db.promise().query(
      `
      SELECT q.*, COALESCE(q.ideal_time, 60) as ideal_time
      FROM questions q
      WHERE q.id NOT IN (
        SELECT question_id 
        FROM responses 
        WHERE student_id = ?
      )
      ORDER BY q.id ASC
      LIMIT 1
    `,
      [student_id]
    );

    res.json({
      success: true,
      message: "Answer submitted successfully",
      is_correct: is_correct,
      next_question: nextQuestion.length > 0 ? nextQuestion[0] : null,
    });
  } catch (err) {
    console.error("Error submitting answer:", err);
    res.status(500).json({ error: "Failed to submit answer" });
  }
};
