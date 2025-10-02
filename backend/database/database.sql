-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL,
    ideal_time INT NOT NULL, -- in seconds
    category VARCHAR(50),
    difficulty_level INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create responses table
CREATE TABLE IF NOT EXISTS responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option CHAR(1) NOT NULL,
    time_taken INT NOT NULL, -- in seconds
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Create test_sessions table
CREATE TABLE IF NOT EXISTS test_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    total_score INT,
    FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Create admin table
CREATE TABLE IF NOT EXISTS admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create question_timing_analysis table
CREATE TABLE IF NOT EXISTS question_timing_analysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    question_id INT NOT NULL,
    time_taken INT NOT NULL COMMENT 'Time taken by student in seconds',
    ideal_time INT NOT NULL COMMENT 'Ideal time to solve the question in seconds',
    is_suspicious BOOLEAN DEFAULT FALSE COMMENT 'Flag for suspiciously fast answers',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_student_question (student_id, question_id)
);

-- Create question_suspicion_levels table
CREATE TABLE IF NOT EXISTS question_suspicion_levels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    question_id INT NOT NULL,
    suspicion_level ENUM('Highly Suspicious', 'Moderately Suspicious', 'Normal') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    INDEX idx_question_suspicion (question_id, suspicion_level)
);

-- Create suspicious_answers view
CREATE OR REPLACE VIEW suspicious_answers AS
SELECT 
    qta.id,
    u.username,
    q.question_text,
    qta.time_taken,
    qta.ideal_time,
    qta.time_taken / qta.ideal_time AS time_ratio,
    CASE 
        WHEN qta.time_taken < qta.ideal_time * 0.3 THEN 'Highly Suspicious'
        WHEN qta.time_taken < qta.ideal_time * 0.5 THEN 'Suspicious'
        WHEN qta.time_taken < qta.ideal_time * 0.7 THEN 'Moderately Suspicious'
        ELSE 'Normal'
    END AS suspicion_level
FROM 
    question_timing_analysis qta
JOIN 
    users u ON qta.student_id = u.id
JOIN 
    questions q ON qta.question_id = q.id
WHERE 
    qta.time_taken < qta.ideal_time * 0.7
ORDER BY 
    time_ratio ASC;

-- Create stored procedure for inserting timing data
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS insert_question_timing(
    IN p_student_id INT,
    IN p_question_id INT,
    IN p_time_taken INT,
    IN p_ideal_time INT
)
BEGIN
    DECLARE v_is_suspicious BOOLEAN;
    
    -- Determine if the answer is suspicious based on time ratio
    IF p_time_taken < p_ideal_time * 0.5 THEN
        SET v_is_suspicious = TRUE;
    ELSE
        SET v_is_suspicious = FALSE;
    END IF;
    
    -- Insert the timing data
    INSERT INTO question_timing_analysis 
    (student_id, question_id, time_taken, ideal_time, is_suspicious)
    VALUES 
    (p_student_id, p_question_id, p_time_taken, p_ideal_time, v_is_suspicious);
    
    -- Return the suspicion status
    SELECT v_is_suspicious AS is_suspicious;
END //
DELIMITER ;

-- Create a trigger to automatically update question_suspicion_levels
DELIMITER //
CREATE TRIGGER update_question_suspicion_levels
AFTER INSERT ON question_timing_analysis
FOR EACH ROW
BEGIN
    DECLARE suspicion_category ENUM('Highly Suspicious', 'Moderately Suspicious', 'Normal');
    
    -- Determine suspicion level based on time ratio
    IF NEW.time_taken < NEW.ideal_time * 0.3 THEN
        SET suspicion_category = 'Highly Suspicious';
    ELSEIF NEW.time_taken < NEW.ideal_time * 0.7 THEN
        SET suspicion_category = 'Moderately Suspicious';
    ELSE
        SET suspicion_category = 'Normal';
    END IF;
    
    -- Insert or update the suspicion level for this question
    INSERT INTO question_suspicion_levels (question_id, suspicion_level)
    VALUES (NEW.question_id, suspicion_category)
    ON DUPLICATE KEY UPDATE 
        suspicion_level = suspicion_category,
        updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- Add some sample questions
INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, ideal_time, category, difficulty_level) VALUES
('What is 2 + 2?', '3', '4', '5', '6', 'B', 30, 'Basic Math', 1),
('What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', 'C', 45, 'Geography', 1),
('What is 15 x 15?', '200', '225', '250', '275', 'B', 60, 'Basic Math', 2);

-- Create admin user with a strong password (this is just an example, change it in production)
-- Password: Admin@123456
INSERT INTO admins (username, password) VALUES 
('admin', '$2a$10$8K1p/a0dL1LXMIZoIqPK6.U/BOkNGx1kLY5sA8hxQN9V3UF9.5QHy');

-- Add more comprehensive sample timing data for testing
INSERT INTO question_timing_analysis (student_id, question_id, time_taken, ideal_time, is_suspicious) VALUES
-- Student 1: Mix of suspicious and normal answers
(1, 1, 10, 30, TRUE),   -- Highly suspicious (33% of ideal time)
(1, 2, 20, 45, TRUE),   -- Suspicious (44% of ideal time)
(1, 3, 35, 60, FALSE),  -- Normal (58% of ideal time)
(1, 1, 8, 30, TRUE),    -- Highly suspicious (27% of ideal time)
(1, 2, 15, 45, TRUE),   -- Highly suspicious (33% of ideal time)
(1, 3, 40, 60, FALSE),  -- Normal (67% of ideal time)

-- Student 2: Mostly suspicious answers
(2, 1, 5, 30, TRUE),    -- Highly suspicious (17% of ideal time)
(2, 2, 10, 45, TRUE),   -- Highly suspicious (22% of ideal time)
(2, 3, 20, 60, TRUE),   -- Suspicious (33% of ideal time)
(2, 1, 7, 30, TRUE),    -- Highly suspicious (23% of ideal time)
(2, 2, 12, 45, TRUE),   -- Highly suspicious (27% of ideal time)
(2, 3, 25, 60, TRUE),   -- Suspicious (42% of ideal time)

-- Student 3: Mix of all categories
(3, 1, 25, 30, FALSE),  -- Normal (83% of ideal time)
(3, 2, 35, 45, FALSE),  -- Normal (78% of ideal time)
(3, 3, 45, 60, FALSE),  -- Normal (75% of ideal time)
(3, 1, 8, 30, TRUE),    -- Highly suspicious (27% of ideal time)
(3, 2, 15, 45, TRUE),   -- Highly suspicious (33% of ideal time)
(3, 3, 30, 60, TRUE);   -- Suspicious (50% of ideal time)

-- Add more questions with different categories
INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, ideal_time, category, difficulty_level) VALUES
('What is the square root of 144?', '10', '12', '14', '16', 'B', 45, 'Mathematics', 2),
('Which planet is known as the Red Planet?', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'B', 30, 'Science', 1),
('What is the capital of Japan?', 'Beijing', 'Seoul', 'Tokyo', 'Bangkok', 'C', 30, 'Geography', 1),
('Who wrote "Romeo and Juliet"?', 'Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain', 'B', 45, 'Literature', 2),
('What is the chemical symbol for gold?', 'Ag', 'Fe', 'Au', 'Cu', 'C', 30, 'Science', 1);

-- Add more timing data for the new questions
INSERT INTO question_timing_analysis (student_id, question_id, time_taken, ideal_time, is_suspicious) VALUES
-- Student 1: More suspicious answers
(1, 4, 12, 45, TRUE),   -- Highly suspicious (27% of ideal time)
(1, 5, 8, 30, TRUE),    -- Highly suspicious (27% of ideal time)
(1, 6, 20, 30, TRUE),   -- Suspicious (67% of ideal time)
(1, 7, 15, 45, TRUE),   -- Highly suspicious (33% of ideal time)
(1, 8, 10, 30, TRUE),   -- Highly suspicious (33% of ideal time)

-- Student 2: More suspicious answers
(2, 4, 10, 45, TRUE),   -- Highly suspicious (22% of ideal time)
(2, 5, 7, 30, TRUE),    -- Highly suspicious (23% of ideal time)
(2, 6, 15, 30, TRUE),   -- Highly suspicious (50% of ideal time)
(2, 7, 12, 45, TRUE),   -- Highly suspicious (27% of ideal time)
(2, 8, 8, 30, TRUE);    -- Highly suspicious (27% of ideal time)

-- Student 3: Mix of answers
(3, 4, 35, 45, FALSE),  -- Normal (78% of ideal time)
(3, 5, 25, 30, FALSE),  -- Normal (83% of ideal time)
(3, 6, 20, 30, TRUE),   -- Suspicious (67% of ideal time)
(3, 7, 30, 45, FALSE),  -- Normal (67% of ideal time)
(3, 8, 22, 30, FALSE);  -- Normal (73% of ideal time)

-- Add sample users for testing
INSERT INTO users (username, password, email) VALUES
('student1', '$2a$10$8K1p/a0dL1LXMIZoIqPK6.U/BOkNGx1kLY5sA8hxQN9V3UF9.5QHy', 'student1@example.com'),
('student2', '$2a$10$8K1p/a0dL1LXMIZoIqPK6.U/BOkNGx1kLY5sA8hxQN9V3UF9.5QHy', 'student2@example.com'),
('student3', '$2a$10$8K1p/a0dL1LXMIZoIqPK6.U/BOkNGx1kLY5sA8hxQN9V3UF9.5QHy', 'student3@example.com');

-- Create a view for question suspicion statistics
CREATE OR REPLACE VIEW question_suspicion_stats AS
SELECT 
    q.id AS question_id,
    q.question_text,
    qsl.suspicion_level,
    COUNT(DISTINCT qta.student_id) AS student_count,
    AVG(qta.time_taken / qta.ideal_time) AS avg_time_ratio
FROM 
    questions q
LEFT JOIN 
    question_suspicion_levels qsl ON q.id = qsl.question_id
LEFT JOIN 
    question_timing_analysis qta ON q.id = qta.question_id
GROUP BY 
    q.id, q.question_text, qsl.suspicion_level; 