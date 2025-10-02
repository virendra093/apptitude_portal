const db = require("../config/db");
const bcrypt = require("bcryptjs");
const path = require("path");

exports.getLogin = (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/views/admin-login.html"));
};

exports.postLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log(`Admin login attempt for username: ${username}`);

    // Check if username and password are provided
    if (!username || !password) {
      console.log("Missing username or password");
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Query the database for the admin
    const [admins] = await db
      .promise()
      .query("SELECT * FROM admins WHERE username = ?", [username]);

    console.log(`Found ${admins.length} admin(s) with username: ${username}`);

    if (admins.length > 0) {
      const admin = admins[0];
      console.log("Comparing passwords...");

      // Compare the provided password with the stored hash
      const isMatch = await bcrypt.compare(password, admin.password);
      console.log(`Password match: ${isMatch}`);

      if (isMatch) {
        // Set admin session
        req.session.admin = {
          id: admin.id,
          username: admin.username,
        };
        console.log("Admin login successful, redirecting to dashboard");
        return res.json({ success: true, redirect: "/admin/dashboard" });
      } else {
        console.log("Password incorrect");
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }
    } else {
      console.log("Admin not found");
      return res.status(401).json({
        success: false,
        message: "Admin username not found",
      });
    }
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again.",
    });
  }
};

exports.getDashboard = (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }
  res.sendFile(path.join(__dirname, "../../frontend/views/admin-dashboard.html"));
};

exports.getResults = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { sortBy = "score", sortOrder = "desc" } = req.query;

    const [results] = await db.promise().query(`
            SELECT 
                u.username,
                COUNT(*) as total_questions,
                SUM(r.is_correct) as correct_answers,
                (SUM(r.is_correct) / COUNT(*) * 100) as score,
                MAX(r.created_at) as date,
                SUM(r.time_taken) as time_taken
            FROM responses r
            JOIN users u ON r.student_id = u.id
            GROUP BY r.student_id, u.username
            ORDER BY ${sortBy} ${sortOrder}
        `);

    res.json({ success: true, results });
  } catch (err) {
    console.error("Error fetching results:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch results" });
  }
};

exports.logout = (req, res) => {
  req.session.admin = null;
  res.redirect("/admin/login");
};

exports.checkLoginStatus = (req, res) => {
  res.json({ isLoggedIn: !!req.session.admin });
};

exports.changePassword = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { currentPassword, newPassword } = req.body;
  const adminId = req.session.admin.id;

  try {
    // Get admin's current password
    const [admins] = await db
      .promise()
      .query("SELECT password FROM admins WHERE id = ?", [adminId]);

    if (admins.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admins[0].password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await db
      .promise()
      .query("UPDATE admins SET password = ? WHERE id = ?", [
        hashedPassword,
        adminId,
      ]);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Error changing password:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "An error occurred while changing password",
      });
  }
};

// Question management functions
exports.getQuestionsPage = (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }
  res.sendFile(path.join(__dirname, "../../frontend/views/admin-questions.html"));
};

exports.getQuestions = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const { category, difficulty } = req.query;
    let query = "SELECT * FROM questions";
    const params = [];

    if (category || difficulty) {
      query += " WHERE";
      if (category) {
        query += " category = ?";
        params.push(category);
      }
      if (difficulty) {
        if (category) query += " AND";
        query += " difficulty_level = ?";
        params.push(difficulty);
      }
    }

    query += " ORDER BY id DESC";

    const [questions] = await db.promise().query(query, params);
    res.json({ success: true, questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching questions" });
  }
};

exports.addQuestion = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      ideal_time,
      category,
      difficulty_level,
    } = req.body;

    // Validate required fields
    if (
      !question_text ||
      !option_a ||
      !option_b ||
      !option_c ||
      !option_d ||
      !correct_option ||
      !ideal_time ||
      !category ||
      !difficulty_level
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // Validate correct option
    if (!["A", "B", "C", "D"].includes(correct_option)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid correct option" });
    }

    // Insert question
    const [result] = await db
      .promise()
      .query(
        "INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, ideal_time, category, difficulty_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          ideal_time,
          category,
          difficulty_level,
        ]
      );

    res.json({
      success: true,
      message: "Question added successfully",
      questionId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding question:", error);
    res.status(500).json({ success: false, message: "Error adding question" });
  }
};

exports.getQuestion = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const [questions] = await db
      .promise()
      .query("SELECT * FROM questions WHERE id = ?", [req.params.id]);

    if (questions.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    res.json({ success: true, question: questions[0] });
  } catch (error) {
    console.error("Error fetching question:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching question" });
  }
};

exports.updateQuestion = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      ideal_time,
      category,
      difficulty_level,
    } = req.body;

    // Validate required fields
    if (
      !question_text ||
      !option_a ||
      !option_b ||
      !option_c ||
      !option_d ||
      !correct_option ||
      !ideal_time ||
      !category ||
      !difficulty_level
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // Validate correct option
    if (!["A", "B", "C", "D"].includes(correct_option)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid correct option" });
    }

    // Update question
    await db
      .promise()
      .query(
        "UPDATE questions SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, ideal_time = ?, category = ?, difficulty_level = ? WHERE id = ?",
        [
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          ideal_time,
          category,
          difficulty_level,
          req.params.id,
        ]
      );

    res.json({ success: true, message: "Question updated successfully" });
  } catch (error) {
    console.error("Error updating question:", error);
    res
      .status(500)
      .json({ success: false, message: "Error updating question" });
  }
};

exports.deleteQuestion = async (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const connection = db.promise();
    await connection.beginTransaction();

    const questionId = req.params.id;

    // Delete dependent records first to satisfy FK constraints
    await connection.query(
      "DELETE FROM responses WHERE question_id = ?",
      [questionId]
    );
    await connection.query(
      "DELETE FROM question_timing_analysis WHERE question_id = ?",
      [questionId]
    );
    // Optional auxiliary tables/views if present
    await connection.query(
      "DELETE FROM question_suspicion_levels WHERE question_id = ?",
      [questionId]
    ).catch(() => {});
    await connection.query(
      "DELETE FROM suspicious_answers WHERE question_id = ?",
      [questionId]
    ).catch(() => {});

    // Finally delete the question
    await connection.query("DELETE FROM questions WHERE id = ?", [questionId]);

    await connection.commit();
    res.json({ success: true, message: "Question deleted successfully" });
  } catch (error) {
    try {
      await db.promise().rollback();
    } catch (_) {}
    console.error("Error deleting question:", error);
    res.status(500).json({ success: false, message: "Error deleting question" });
  }
};
