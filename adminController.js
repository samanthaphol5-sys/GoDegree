const pool = require('../db');

// GET /admin/users
exports.getUsers = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const [users] = await conn.query(
            `SELECT u.Username AS username, s.Student_ID AS student_id
             FROM user u
             JOIN student s ON u.User_ID = s.User_ID
             ORDER BY u.Username`
        );
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    } finally {
        conn.release();
    }
};

// POST /admin/courses
exports.addCourse = async (req, res) => {
    const { course_code, course_name, credit, course_type, schedule } = req.body;

    if (schedule && !/^Year [1-4] Semester [1-2]$/.test(schedule)) {
         return res.status(400).json({ error: 'Schedule must look like "Year 3 Semester 1"' });
    }
    
    if (!course_code || !course_name || credit === undefined || !course_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Number.isInteger(Number(credit)) || Number(credit) <= 0) {
        return res.status(400).json({ error: 'Credit must be a positive integer' });
    }

    if (!['Core', 'Elective'].includes(course_type)) {
        return res.status(400).json({ error: 'Course type must be Core or Elective' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.query(
            `INSERT INTO Course (Course_Code, Course_Name, Credit, Course_Type, Schedule)
             VALUES (?, ?, ?, ?, ?)`,
            [course_code, course_name, credit, course_type, schedule || null]
        );
        res.status(201).json({ message: 'Course added successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Course code already exists' });
        }
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    } finally {
        conn.release();
    }
};

// DELETE /admin/courses/:courseCode
exports.deleteCourse = async (req, res) => {
    const { courseCode } = req.params;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [[{ count }]] = await conn.query(
            `SELECT COUNT(*) as count FROM Enrollment WHERE Course_Code = ?`,
            [courseCode]
        );

        if (count > 0) {
            await conn.rollback();
            return res.status(409).json({ error: 'There are students enrolled in this course.' });
        }

        await conn.query(
            `DELETE FROM Prerequisite WHERE Course_Code = ? OR Prereq_Code = ?`,
            [courseCode, courseCode]
        );

        const [result] = await conn.query(`DELETE FROM Course WHERE Course_Code = ?`, [courseCode]);

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Course not found' });
        }

        await conn.commit();
        res.json({ message: 'Course deleted successfully' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ error: 'วิชานี้มีนักศึกษาลงทะเบียนอยู่' });
        }
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    } finally {
        conn.release();
    }
};

// Validate the values used by Academic_Catalog.
function validateCatalogFields(fileName, fileUrl) {
    const name = String(fileName || '').trim();
    const url = String(fileUrl || '').trim();

    if (!name) {
        return { error: 'Catalog file name is required' };
    }
    if (name.length > 255) {
        return { error: 'Catalog file name must be 255 characters or fewer' };
    }
    if (url.length > 255) {
        return { error: 'Catalog URL must be 255 characters or fewer' };
    }
    if (url) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:') {
                return { error: 'Catalog URL must use HTTPS' };
            }
        } catch (_error) {
            return { error: 'Please enter a valid catalog URL' };
        }
    }

    return { value: { fileName: name, fileUrl: url || null } };
}

// GET /admin/catalogs
exports.getCatalogs = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT Catalog_Year AS catalog_year,
                    File_Name AS file_name,
                    File_URL AS file_url
             FROM Academic_Catalog
             ORDER BY Catalog_Year DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('Get academic catalogs error:', err);
        res.status(500).json({ error: 'Unable to load academic catalogs. Please try again.' });
    } finally {
        conn.release();
    }
};

// POST /admin/catalogs
exports.addCatalog = async (req, res) => {
    const catalogYear = String(req.body?.catalog_year || '').trim();
    const validation = validateCatalogFields(req.body?.file_name, req.body?.file_url);

    if (!/^\d{4}$/.test(catalogYear)) {
        return res.status(400).json({ error: 'Catalog year must contain exactly 4 digits' });
    }
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    const conn = await pool.getConnection();
    try {
        await conn.query(
            `INSERT INTO Academic_Catalog (Catalog_Year, File_Name, File_URL)
             VALUES (?, ?, ?)`,
            [catalogYear, validation.value.fileName, validation.value.fileUrl]
        );
        res.status(201).json({ message: 'Academic catalog added successfully' });
    } catch (err) {
        console.error('Add academic catalog error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: `A catalog for ${catalogYear} already exists` });
        }
        res.status(500).json({ error: 'Unable to add academic catalog. Please try again.' });
    } finally {
        conn.release();
    }
};

// PUT /admin/catalogs/:catalogYear
// Catalog_Year is a primary key referenced by Student, so the year is kept unchanged.
// Admins can update the file name and URL for an existing catalog year.
exports.updateCatalog = async (req, res) => {
    const catalogYear = String(req.params.catalogYear || '').trim();
    const validation = validateCatalogFields(req.body?.file_name, req.body?.file_url);

    if (!/^\d{4}$/.test(catalogYear)) {
        return res.status(400).json({ error: 'Invalid catalog year' });
    }
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    const conn = await pool.getConnection();
    try {
        const [result] = await conn.query(
            `UPDATE Academic_Catalog
             SET File_Name = ?, File_URL = ?
             WHERE Catalog_Year = ?`,
            [validation.value.fileName, validation.value.fileUrl, catalogYear]
        );

        if (result.affectedRows === 0) {
            const [rows] = await conn.query(
                'SELECT Catalog_Year FROM Academic_Catalog WHERE Catalog_Year = ?',
                [catalogYear]
            );
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Academic catalog not found' });
            }
        }

        res.json({ message: `Academic catalog ${catalogYear} updated successfully` });
    } catch (err) {
        console.error('Update academic catalog error:', err);
        res.status(500).json({ error: 'Unable to update academic catalog. Please try again.' });
    } finally {
        conn.release();
    }
};

// DELETE /admin/catalogs/:catalogYear
// A catalog cannot be deleted while students still reference its year.
exports.deleteCatalog = async (req, res) => {
    const catalogYear = String(req.params.catalogYear || '').trim();
    if (!/^\d{4}$/.test(catalogYear)) {
        return res.status(400).json({ error: 'Invalid catalog year' });
    }

    const conn = await pool.getConnection();
    let transactionStarted = false;
    try {
        await conn.beginTransaction();
        transactionStarted = true;

        const [catalogRows] = await conn.query(
            'SELECT Catalog_Year FROM Academic_Catalog WHERE Catalog_Year = ? FOR UPDATE',
            [catalogYear]
        );
        if (catalogRows.length === 0) {
            await conn.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Academic catalog not found' });
        }

        const [[usage]] = await conn.query(
            'SELECT COUNT(*) AS student_count FROM Student WHERE Catalog_Year = ?',
            [catalogYear]
        );
        if (Number(usage.student_count) > 0) {
            await conn.rollback();
            transactionStarted = false;
            return res.status(409).json({
                error: `This catalog is used by ${usage.student_count} student account(s) and cannot be deleted.`
            });
        }

        await conn.query(
            'DELETE FROM Academic_Catalog WHERE Catalog_Year = ?',
            [catalogYear]
        );

        await conn.commit();
        transactionStarted = false;
        res.json({ message: `Academic catalog ${catalogYear} deleted successfully` });
    } catch (err) {
        if (transactionStarted) await conn.rollback();
        console.error('Delete academic catalog error:', err);
        res.status(500).json({ error: 'Unable to delete academic catalog. Please try again.' });
    } finally {
        conn.release();
    }
};
