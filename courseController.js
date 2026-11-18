const pool = require('../db');

// GET /course
exports.getAllCourses = async(req, res) => {
    const conn = await pool.getConnection();
    try{
        const[rows] = await conn.query(
            'select * from course'
        );
        res.json(rows);
    }
    catch(err){
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally {
        conn.release();
    }
};