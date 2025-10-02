const db = require("../config/db");
const bcrypt = require("bcryptjs");
const path = require("path");

exports.getLogin = (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/views/login.html"));
};

exports.postLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    const [results] = await db
      .promise()
      .query("SELECT * FROM users WHERE username = ?", [username]);

    if (results.length > 0) {
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        req.session.user = {
          id: user.id,
          username: user.username,
          email: user.email,
        };
        res.json({ success: true, redirect: "/test" });
      } else {
        res
          .status(401)
          .json({ success: false, message: "Incorrect password." });
      }
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (err) {
    console.error("Login error:", err);
    res
      .status(500)
      .json({ success: false, message: "An error occurred during login." });
  }
};

exports.getRegister = (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/views/register.html"));
};

exports.postRegister = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if username or email already exists
    const [existingUsers] = await db
      .promise()
      .query("SELECT * FROM users WHERE username = ? OR email = ?", [
        username,
        email,
      ]);

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists.",
      });
    }

    // Hash password and create user
    const hash = await bcrypt.hash(password, 10);
    await db
      .promise()
      .query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [
        username,
        email,
        hash,
      ]);

    res.json({
      success: true,
      message: "Registration successful! Redirecting to login...",
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred during registration.",
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect("/auth/login");
};
