const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Viru@245771',
  database: 'apptitude_portal'
});
connection.connect(err => {
  if (err) throw err;
  console.log('Connected to MySQL');
});
module.exports = connection;
