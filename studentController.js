const pool = require('../db');
const bcrypt = require('bcryptjs');

// GET /student/:id
exports.getStudentProfile = async(req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId)) {
        return res.status(400).json({ error: 'Student id must be an integer' });
    }

    const conn = await pool.getConnection();
    try{
        const [rows] = await conn.query(
            `SELECT
                s.*,
                ac.File_Name AS Catalog_File_Name,
                ac.File_URL AS Catalog_File_URL
             FROM Student AS s
             LEFT JOIN Academic_Catalog AS ac
                ON ac.Catalog_Year = s.Catalog_Year
             WHERE s.Student_ID = ?`,
            [studentId]
        );
        if(rows.length === 0){
            return res.status(404).json({error: 'Student not found'});
        }
        
        const student = rows[0];
        res.json({
            student_id: student.Student_ID,
            catalog_year: student.Catalog_Year,
            catalog_file: {
                file_name: student.Catalog_File_Name || null,
                file_url: student.Catalog_File_URL || null
            },
            major: student.Major,
            study_track: student.Study_Track || 'Not Selected',
            study_option: student.Study_Option || 'Not Selected',
            current_semester: student.Current_Semester,
            academic_status: student.Academic_Status,
            cgpa: student.CGPA ? Number(student.CGPA).toFixed(2) : "0.00",
            total_courses: student.Total_Courses || 0,
            total_credit: student.Total_Credit || 0,
            english_score: {
                test_type: student.Eng_Test_Type || '-',
                score: student.Eng_Score || 0,
                status: student.Eng_Status || 'Fail'
            }
        });
    }
    catch (err){
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally {
        conn.release();
    }
};

// PUT /student/:id/eng_score
exports.updateEngscore = async(req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId)) {
        return res.status(400).json({ error: 'Student id must be an integer' });
    }
    
    const conn = await pool.getConnection();
    try{
        const {testType, score} = req.body;

        await conn.query(
            'call check_eng_score(?, ?, ?, @status)',
        [studentId, score, testType]);
        const[result] = await conn.query(
            'select @status as eng_status'
        );
        res.json({message: 'Update successful', newStatus: result[0].eng_status});
    }
    catch(err){
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally {
        conn.release();
    }
};

// PUT /student/:id/target_honor
exports.updateTargetHonor = async(req, res) => {
    const studentId = Number(req.params.id);
    const {honor_type} = req.body;

    if (!Number.isInteger(studentId) || !honor_type) {
        return res.status(400).json({ error: 'Missing student ID or honor type' });
    }

    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        await conn.query('delete from student_target_honor where student_id = ?',[studentId]);

        await conn.query(
            `insert into student_target_honor(student_id, honor_type) values (?,?)`,
            [studentId, honor_type]
        );

        await conn.commit();
        res.json({message: 'Target honor updated successfully'})
    }
    catch(err){
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
};

// PUT /student/:id/study_info
exports.updateStudentInfo = async (req, res) => {
    const studentId = Number(req.params.id);
    const {study_option, study_track} = req.body;

    if (!Number.isInteger(studentId)) {
        return res.status(400).json({ error: 'Invalid student ID' });
    }

    const conn = await pool.getConnection();
    try{
        const [result] = await conn.query(
            `update student
            set study_option = coalesce(?, study_option),
            study_track = coalesce(?, study_track) 
            where student_id = ?`,
            [study_option, study_track, studentId]
        );

        if(result.affectedRows === 0){
            return res.status(404).json({error: 'Student not found'});
        }
        res.json({message: 'Study info updated successfully'})
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
};

// PUT /student/:id/password
// Allows a signed-in student to change their own password after verifying the current one.
exports.changePassword = async (req, res) => {
    const studentId = String(req.params.id || '');
    const userId = Number(req.user?.user_id);
    const { current_password, new_password, confirm_password } = req.body || {};

    if (!/^\d{10}$/.test(studentId)) {
        return res.status(400).json({ error: 'Invalid student ID' });
    }

    if (req.user?.role !== 'user' || !Number.isInteger(userId)) {
        return res.status(403).json({ error: 'Only the account owner can change this password' });
    }

    if (typeof current_password !== 'string' || current_password.length === 0 ||
        typeof new_password !== 'string' || new_password.length < 8 ||
        typeof confirm_password !== 'string' || confirm_password.length === 0) {
        return res.status(400).json({ error: 'Enter your current password and a new password with at least 8 characters' });
    }

    // bcrypt only uses up to 72 bytes; reject longer UTF-8 input instead of silently truncating it.
    if (Buffer.byteLength(new_password, 'utf8') > 72) {
        return res.status(400).json({ error: 'New password must be no longer than 72 bytes' });
    }

    if (new_password !== confirm_password) {
        return res.status(400).json({ error: 'The new passwords do not match' });
    }

    if (current_password === new_password) {
        return res.status(400).json({ error: 'Your new password must be different from your current password' });
    }

    const conn = await pool.getConnection();
    let transactionStarted = false;

    try {
        await conn.beginTransaction();
        transactionStarted = true;

        // Match the signed-in user to the requested student record and lock the account row.
        const [rows] = await conn.query(
            `SELECT u.Password
             FROM Student AS s
             INNER JOIN User AS u ON u.User_ID = s.User_ID
             WHERE s.Student_ID = ? AND s.User_ID = ?
             FOR UPDATE`,
            [studentId, userId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Student account not found' });
        }

        const passwordMatches = await bcrypt.compare(current_password, rows[0].Password);
        if (!passwordMatches) {
            await conn.rollback();
            transactionStarted = false;
            return res.status(400).json({ error: 'Your current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        const [result] = await conn.query(
            'UPDATE User SET Password = ? WHERE User_ID = ?',
            [hashedPassword, userId]
        );

        if (result.affectedRows !== 1) {
            throw new Error('Password update did not affect exactly one user record');
        }

        await conn.commit();
        transactionStarted = false;
        return res.json({ message: 'Password changed successfully' });
    } catch (err) {
        if (transactionStarted) await conn.rollback();
        console.error('[changePassword] Password update failed:', err);
        return res.status(500).json({ error: 'Unable to change your password right now. Please try again.' });
    } finally {
        conn.release();
    }
};

// DELETE /student/:id/account
// Permanently deletes the signed-in student's account and related records.
exports.deleteAccount = async (req, res) => {
    const studentId = String(req.params.id || '');
    const userId = Number(req.user?.user_id);
    const password = req.body?.password;

    if (!/^\d{10}$/.test(studentId)) {
        return res.status(400).json({ error: 'Invalid student ID' });
    }

    // Only a signed-in student can delete their own account.
    if (req.user?.role !== 'user' || !Number.isInteger(userId)) {
        return res.status(403).json({ error: 'Only the account owner can delete this account' });
    }

    if (typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ error: 'Please enter your current password' });
    }

    const conn = await pool.getConnection();
    let transactionStarted = false;

    try {
        await conn.beginTransaction();
        transactionStarted = true;

        // Lock and verify the exact student account represented by the JWT.
        const [rows] = await conn.query(
            `SELECT s.Student_ID, s.User_ID, u.Password
             FROM Student AS s
             INNER JOIN User AS u ON u.User_ID = s.User_ID
             WHERE s.Student_ID = ? AND s.User_ID = ?
             FOR UPDATE`,
            [studentId, userId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Student account not found' });
        }

        const passwordMatches = await bcrypt.compare(password, rows[0].Password);
        if (!passwordMatches) {
            await conn.rollback();
            transactionStarted = false;
            // Use 400 rather than 401: the frontend treats 401 as an expired login token.
            return res.status(400).json({ error: 'The current password is incorrect' });
        }

        // The schema has no ON DELETE CASCADE, so remove dependent rows first.
        await conn.query(
            'DELETE FROM Student_Target_Honor WHERE Student_ID = ?',
            [studentId]
        );
        await conn.query(
            'DELETE FROM Enrollment WHERE Student_ID = ?',
            [studentId]
        );
        await conn.query(
            'DELETE FROM Student WHERE Student_ID = ? AND User_ID = ?',
            [studentId, userId]
        );
        const [userResult] = await conn.query(
            'DELETE FROM User WHERE User_ID = ?',
            [userId]
        );

        if (userResult.affectedRows !== 1) {
            throw new Error('Account deletion did not remove exactly one user record');
        }

        await conn.commit();
        transactionStarted = false;
        return res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        if (transactionStarted) {
            await conn.rollback();
        }
        console.error('[deleteAccount] Account deletion failed:', err);
        return res.status(500).json({
            error: 'Unable to delete the account right now. Please try again or contact the administrator.'
        });
    } finally {
        conn.release();
    }
};
