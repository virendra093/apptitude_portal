const express = require('express');
const router = express.Router();
const db = require('../config/db.js');

// Handle contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    // Validate input
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Insert into feedback table
    const query = `
      INSERT INTO feedback (name, email, subject, message, category, status) 
      VALUES (?, ?, 'Contact Form Submission', ?, 'General', 'New')
    `;
    
    db.query(query, [name, email, message], (err, result) => {
      if (err) {
        console.error('Error saving feedback:', err);
        return res.status(500).json({
          success: false,
          message: 'An error occurred while submitting your message. Please try again.'
        });
      }
      
      // Return success response
      res.json({
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon.'
      });
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while submitting your message. Please try again.'
    });
  }
});

module.exports = router; 