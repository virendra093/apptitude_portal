/**
 * Timing Analysis Module
 * Tracks and analyzes student response times for questions
 */

// Store the start time when a question is loaded
let questionStartTime = null;
let currentQuestionId = null;
let idealTimeForQuestion = null;

/**
 * Initialize timing tracking for a question
 * @param {number} questionId - The ID of the current question
 * @param {number} idealTime - The ideal time to solve the question (in seconds)
 */
function initQuestionTiming(questionId, idealTime) {
    questionStartTime = Date.now();
    currentQuestionId = questionId;
    idealTimeForQuestion = idealTime;
    console.log(`Timing initialized for question ${questionId} with ideal time ${idealTime}s`);
}

/**
 * Calculate and submit the time taken to answer a question
 * @param {number} studentId - The ID of the current student
 * @returns {Promise} - Promise that resolves when timing data is submitted
 */
async function submitQuestionTiming(studentId) {
    if (!questionStartTime || !currentQuestionId || !idealTimeForQuestion) {
        console.error('Timing data not initialized');
        return;
    }

    const endTime = Date.now();
    const timeTakenMs = endTime - questionStartTime;
    const timeTakenSeconds = Math.round(timeTakenMs / 1000);

    console.log(`Time taken: ${timeTakenSeconds}s (Ideal: ${idealTimeForQuestion}s)`);

    try {
        const response = await fetch('/api/question-timing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                studentId,
                questionId: currentQuestionId,
                timeTaken: timeTakenSeconds,
                idealTime: idealTimeForQuestion
            })
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('Timing data submitted successfully');
            
            // If the answer is suspicious, show a warning
            if (data.isSuspicious) {
                console.warn('Suspiciously fast answer detected');
                // You could show a UI warning here if needed
            }
        } else {
            console.error('Failed to submit timing data:', data.message);
        }
    } catch (error) {
        console.error('Error submitting timing data:', error);
    }

    // Reset timing data
    questionStartTime = null;
    currentQuestionId = null;
    idealTimeForQuestion = null;
}

/**
 * Get the current time taken so far (for display purposes)
 * @returns {number} - Time taken in seconds
 */
function getCurrentTimeTaken() {
    if (!questionStartTime) return 0;
    
    const currentTime = Date.now();
    const timeTakenMs = currentTime - questionStartTime;
    return Math.round(timeTakenMs / 1000);
}

// Export functions for use in other modules
window.timingAnalysis = {
    initQuestionTiming,
    submitQuestionTiming,
    getCurrentTimeTaken
}; 