const mysql = require("mysql2");
const connection = mysql.createConnection({
  host: process.env.DB_HOST, // e.g., "aws.connect.psdb.cloud"
  user: process.env.DB_USER, // from provider
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 4000,
});
connection.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL");
});
module.exports = connection;
