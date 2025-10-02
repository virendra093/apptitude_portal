-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    email VARCHAR(100),
    name VARCHAR(100),
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    category ENUM('General', 'Technical', 'Content', 'User Experience', 'Bug Report', 'Feature Request') NOT NULL,
    status ENUM('New', 'In Progress', 'Resolved', 'Closed') DEFAULT 'New',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create feedback_responses table for admin responses
CREATE TABLE IF NOT EXISTS feedback_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    feedback_id INT NOT NULL,
    admin_id INT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
);

-- Add indexes for better performance
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_category ON feedback(category);
CREATE INDEX idx_feedback_created ON feedback(created_at);

-- Add some sample feedback (optional)
INSERT INTO feedback (user_id, email, name, subject, message, rating, category) VALUES
(NULL, 'john@example.com', 'John Doe', 'Great Platform!', 'I really enjoyed using this platform. The interface is intuitive and the content is well-organized.', 5, 'General'),
(NULL, 'jane@example.com', 'Jane Smith', 'Feature Suggestion', 'It would be great to have a dark mode option for better visibility at night.', 4, 'Feature Request'); 