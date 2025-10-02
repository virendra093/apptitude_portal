-- Create a table to track question timing analysis
CREATE TABLE question_timing_analysis (
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

-- Create a view to analyze suspicious answers
CREATE VIEW suspicious_answers AS
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

-- Create a stored procedure to insert timing data and automatically flag suspicious answers
DELIMITER //
CREATE PROCEDURE insert_question_timing(
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

-- Create a function to calculate the average time ratio for a student
DELIMITER //
CREATE FUNCTION calculate_student_time_ratio(p_student_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
    DECLARE v_avg_ratio DECIMAL(10,2);
    
    SELECT AVG(time_taken / ideal_time)
    INTO v_avg_ratio
    FROM question_timing_analysis
    WHERE student_id = p_student_id;
    
    RETURN v_avg_ratio;
END //
DELIMITER ;

-- Create a view for student performance analysis
CREATE VIEW student_performance_analysis AS
SELECT 
    u.id AS student_id,
    u.username,
    COUNT(qta.id) AS total_questions_answered,
    SUM(CASE WHEN qta.is_suspicious THEN 1 ELSE 0 END) AS suspicious_answers,
    AVG(qta.time_taken / qta.ideal_time) AS avg_time_ratio,
    CASE 
        WHEN AVG(qta.time_taken / qta.ideal_time) < 0.3 THEN 'Very Fast'
        WHEN AVG(qta.time_taken / qta.ideal_time) < 0.5 THEN 'Fast'
        WHEN AVG(qta.time_taken / qta.ideal_time) < 0.7 THEN 'Moderate'
        ELSE 'Normal'
    END AS speed_category
FROM 
    users u
LEFT JOIN 
    question_timing_analysis qta ON u.id = qta.student_id
GROUP BY 
    u.id, u.username
ORDER BY 
    suspicious_answers DESC, avg_time_ratio ASC; 