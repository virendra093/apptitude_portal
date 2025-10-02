const db = require('./config/db');
const bcrypt = require('bcryptjs');

async function resetAdminPassword() {
  try {
    // Default admin credentials
    const username = 'admin';
    const password = 'Admin@123456';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if admin exists
    const [admins] = await db.promise().query(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );
    
    if (admins.length > 0) {
      // Update existing admin
      await db.promise().query(
        'UPDATE admins SET password = ? WHERE username = ?',
        [hashedPassword, username]
      );
      console.log(`Admin password updated for user: ${username}`);
    } else {
      // Create new admin
      await db.promise().query(
        'INSERT INTO admins (username, password) VALUES (?, ?)',
        [username, hashedPassword]
      );
      console.log(`New admin created with username: ${username}`);
    }
    
    console.log('Admin password reset successful!');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    
    // Close the database connection
    db.end();
  } catch (error) {
    console.error('Error resetting admin password:', error);
    db.end();
  }
}

// Run the function
resetAdminPassword(); 