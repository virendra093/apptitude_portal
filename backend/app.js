const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("./config/db.js");

const authRoutes = require("./routes/auth");
const testRoutes = require("./routes/test");
const resultRoutes = require("./routes/result");
const performanceRoutes = require("./routes/performance");
const adminRoutes = require("./routes/admin");
const timingRoutes = require("./routes/timingRoutes");
const contactRoutes = require("./routes/contact");

const app = express();

const sessionStore = new MySQLStore(
  {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "Viru@245771",
    database: process.env.DB_NAME || "apptitude_portal",
    port: 4000,
    createDatabaseTable: true, // auto create the 'sessions' table if not exists
  },
  db.promise().pool // reuse the same db connection if you want
);

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));
app.use(
  session({
    secret: "asdfghjkl1234567890",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect("/auth/login");
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session.admin) {
    return next();
  }
  res.redirect("/admin/login");
};

// Routes
app.use("/auth", authRoutes);
app.use("/test", isAuthenticated, testRoutes);
app.use("/result", isAuthenticated, resultRoutes);
app.use("/performance", isAuthenticated, performanceRoutes);
app.use("/admin", adminRoutes);
app.use("/api", timingRoutes);
app.use("/", contactRoutes);

// Serve the home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/views", "home.html"));
});

// Auth routes are handled by authRoutes middleware

// Serve the timing analysis dashboard (admin only)
app.get("/admin/timing-analysis", isAdmin, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/views", "timing-analysis.html")
  );
});

// Serve the suspicious analysis page (admin only)
app.get("/admin/suspicious-analysis", isAdmin, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/views", "suspicious-analysis.html")
  );
});

// Handle login
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Query the database for the user
    const query = "SELECT * FROM users WHERE username = ?";
    db.query(query, [username], async (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "An error occurred during login. Please try again.",
        });
      }

      if (results.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      const user = results[0];

      // Compare the provided password with the stored hash
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      // Set user session
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };

      res.json({
        success: true,
        redirect: "/test",
        user: {
          username: user.username,
          email: user.email,
        },
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again.",
    });
  }
});

// Handle logout
app.get("/auth/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Get user session info
app.get("/api/user", (req, res) => {
  if (req.session.user) {
    res.json({ isLoggedIn: true, user: req.session.user });
  } else {
    res.json({ isLoggedIn: false });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
