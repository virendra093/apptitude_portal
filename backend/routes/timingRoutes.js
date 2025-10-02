const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @route POST /api/question-timing
 * @desc Submit timing data for a question
 * @access Private
 */
router.post('/question-timing', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.status(401).json({ 
            success: false, 
            message: 'User not authenticated' 
        });
    }

    const { studentId, questionId, timeTaken, idealTime } = req.body;
    
    // Validate input
    if (!studentId || !questionId || !timeTaken || !idealTime) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields' 
        });
    }
    
    // Verify the student ID matches the logged-in user
    if (studentId !== req.session.user.id) {
        return res.status(403).json({ 
            success: false, 
            message: 'Unauthorized: Student ID does not match logged-in user' 
        });
    }
    
    try {
        // Call the stored procedure to insert timing data
        const [result] = await db.promise().query(
            'CALL insert_question_timing(?, ?, ?, ?)',
            [studentId, questionId, timeTaken, idealTime]
        );
        
        // The stored procedure returns the suspicion status
        const isSuspicious = result[0][0].is_suspicious;
        
        res.json({ 
            success: true, 
            isSuspicious,
            message: isSuspicious ? 'Suspiciously fast answer detected' : 'Timing data recorded'
        });
    } catch (err) {
        console.error('Error recording timing data:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to record timing data' 
        });
    }
});

/**
 * @route GET /api/timing-analysis/suspicious
 * @desc Get suspicious answers (admin only)
 * @access Admin
 */
router.get('/timing-analysis/suspicious', async (req, res) => {
    // Check if user is admin
    if (!req.session.admin) {
        return res.status(401).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    
    try {
        const [suspiciousAnswers] = await db.promise().query(
            'SELECT * FROM suspicious_answers ORDER BY time_ratio ASC LIMIT 100'
        );
        
        res.json({ 
            success: true, 
            suspiciousAnswers 
        });
    } catch (err) {
        console.error('Error fetching suspicious answers:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch suspicious answers' 
        });
    }
});

/**
 * @route GET /api/timing-analysis/student-performance
 * @desc Get student performance analysis (admin only)
 * @access Admin
 */
router.get('/timing-analysis/student-performance', async (req, res) => {
    // Check if user is admin
    if (!req.session.admin) {
        return res.status(401).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    
    try {
        const [studentPerformance] = await db.promise().query(
            'SELECT * FROM student_performance_analysis'
        );
        
        res.json({ 
            success: true, 
            studentPerformance 
        });
    } catch (err) {
        console.error('Error fetching student performance:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch student performance data' 
        });
    }
});

/**
 * @route GET /api/timing-analysis/student-visualization
 * @desc Get suspicious answer visualization data for a specific student
 * @access Admin
 */
router.get('/timing-analysis/student-visualization/:studentId', async (req, res) => {
    // Check if user is admin
    if (!req.session.admin) {
        return res.status(401).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    
    const studentId = req.params.studentId;
    
    try {
        // Get suspicious answers data for Venn diagram using the new table and view
        const [suspiciousData] = await db.promise().query(`
            SELECT 
                COUNT(DISTINCT q.id) as total_answers,
                SUM(CASE WHEN qsl.suspicion_level = 'Highly Suspicious' THEN 1 ELSE 0 END) as highly_suspicious,
                SUM(CASE WHEN qsl.suspicion_level = 'Moderately Suspicious' THEN 1 ELSE 0 END) as moderately_suspicious,
                SUM(CASE WHEN qsl.suspicion_level = 'Normal' THEN 1 ELSE 0 END) as normal,
                SUM(CASE 
                    WHEN qsl.suspicion_level IN ('Highly Suspicious', 'Moderately Suspicious') THEN 1 
                    ELSE 0 
                END) as highly_and_moderate,
                SUM(CASE 
                    WHEN qsl.suspicion_level IN ('Moderately Suspicious', 'Normal') THEN 1 
                    ELSE 0 
                END) as moderate_and_normal,
                SUM(CASE 
                    WHEN qsl.suspicion_level IN ('Highly Suspicious', 'Moderately Suspicious', 'Normal') THEN 1 
                    ELSE 0 
                END) as all_categories
            FROM questions q
            LEFT JOIN question_suspicion_levels qsl ON q.id = qsl.question_id
            WHERE q.id IN (
                SELECT DISTINCT question_id 
                FROM question_timing_analysis 
                WHERE student_id = ?
            )
        `, [studentId]);

        console.log('Suspicious data for student:', studentId, suspiciousData[0]);

        // Get question category distribution for pie chart
        const [categoryData] = await db.promise().query(`
            SELECT 
                q.category,
                COUNT(*) as count,
                SUM(CASE 
                    WHEN qsl.suspicion_level IN ('Highly Suspicious', 'Moderately Suspicious') THEN 1 
                    ELSE 0 
                END) as suspicious_count,
                AVG(qta.time_taken / qta.ideal_time) as avg_time_ratio
            FROM questions q
            JOIN question_timing_analysis qta ON q.id = qta.question_id
            LEFT JOIN question_suspicion_levels qsl ON q.id = qsl.question_id
            WHERE qta.student_id = ?
            GROUP BY q.category
            ORDER BY count DESC
        `, [studentId]);

        // Get time distribution for pie chart
        const [timeDistribution] = await db.promise().query(`
            SELECT 
                qsl.suspicion_level as time_category,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (
                    SELECT COUNT(*) 
                    FROM question_timing_analysis 
                    WHERE student_id = ?
                ), 1) as percentage
            FROM question_timing_analysis qta
            JOIN question_suspicion_levels qsl ON qta.question_id = qsl.question_id
            WHERE qta.student_id = ?
            GROUP BY qsl.suspicion_level
            ORDER BY 
                CASE qsl.suspicion_level
                    WHEN 'Highly Suspicious' THEN 1
                    WHEN 'Moderately Suspicious' THEN 2
                    ELSE 3
                END
        `, [studentId, studentId]);

        // Format category data for pie chart
        const formattedCategoryData = categoryData.map(cat => ({
            category: cat.category,
            count: cat.count,
            suspicious_count: cat.suspicious_count,
            percentage: Math.round((cat.suspicious_count / cat.count) * 100)
        }));

        // Ensure all required fields are present in suspiciousData
        const vennData = {
            total_answers: suspiciousData[0].total_answers || 0,
            highly_suspicious: suspiciousData[0].highly_suspicious || 0,
            moderately_suspicious: suspiciousData[0].moderately_suspicious || 0,
            normal: suspiciousData[0].normal || 0,
            highly_and_moderate: suspiciousData[0].highly_and_moderate || 0,
            moderate_and_normal: suspiciousData[0].moderate_and_normal || 0,
            all_categories: suspiciousData[0].all_categories || 0
        };

        console.log('Formatted Venn data:', vennData);

        res.json({ 
            success: true,
            vennData: vennData,
            categoryData: formattedCategoryData,
            timeDistribution
        });
    } catch (err) {
        console.error('Error fetching visualization data:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch visualization data' 
        });
    }
});

/**
 * @route GET /api/timing-analysis/students
 * @desc Get list of students for analysis
 * @access Admin
 */
router.get('/timing-analysis/students', async (req, res) => {
    // Check if user is admin
    if (!req.session.admin) {
        console.log('Admin access required - session:', req.session);
        return res.status(401).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    
    try {
        console.log('Fetching students from database...');
        
        // First, let's check if there are any users at all
        const [allUsers] = await db.promise().query(`
            SELECT id, username FROM users ORDER BY username
        `);
        console.log('All users in database:', allUsers);
        
        // Then check if there's any timing analysis data
        const [timingData] = await db.promise().query(`
            SELECT DISTINCT student_id FROM question_timing_analysis
        `);
        console.log('Students with timing data:', timingData);
        
        // Now get the students with timing data
        const [students] = await db.promise().query(`
            SELECT DISTINCT u.id, u.username
            FROM users u
            JOIN question_timing_analysis qta ON u.id = qta.student_id
            ORDER BY u.username
        `);
        
        console.log('Students with timing analysis:', students);
        
        // If no students with timing data, return all users as fallback
        let finalStudents = students;
        if (students.length === 0 && allUsers.length > 0) {
            console.log('No students with timing data found, returning all users as fallback');
            finalStudents = allUsers;
        }
        
        res.json({ 
            success: true, 
            students: finalStudents,
            debug: {
                allUsers: allUsers.length,
                timingData: timingData.length,
                studentsWithTiming: students.length,
                finalStudents: finalStudents.length
            }
        });
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch students',
            error: err.message
        });
    }
});

module.exports = router; 