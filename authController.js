const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;

// POST /auth/signup
exports.signup = async(req, res) => {
    const {username, student_id, major, current_semester, password} = req.body;

    if (!username || !student_id || !major || !current_semester || !password) {
        return res.status(400).json({error: 'Missing required fields'});
    }
    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({error: 'Password must be at least 8 characters'});
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({error: 'Password must be no longer than 72 bytes'});
    }
    if (!/^\d{10}$/.test(String(student_id))) {
        return res.status(400).json({error: 'Student ID must be exactly 10 digits'});
    }
    
    const yy = Number(String(student_id).slice(0, 2));
    const catalogYear = 1957 + yy;

    const conn = await pool.getConnection();
    try{
        await conn.beginTransaction();

        const hashedPassword = await bcrypt.hash(password, 10);

        const [userResult] = await conn.query(
            `insert into user (username, password, account_status) values (?, ?, 'Normal')`,
            [username, hashedPassword]
        );

        const newUserId = userResult.insertId;
        await conn.query(
            `insert into student(student_id, user_id, catalog_year, major, current_semester) values (?, ?, ?, ?, ?)`,
            [student_id, newUserId, catalogYear, major, current_semester]
        );

        await conn.commit();
        res.status(201).json({message: 'Account created successfully'});
    }
    catch(err){
        await conn.rollback();
        console.error(err);
        if(err.code === 'ER_DUP_ENTRY'){
            return res.status(409).json({error: 'Username or Student ID already exist'});
        }
        if(err.code === 'ER_NO_REFERENCED_ROW_2'){
            return res.status(400).json({error: `Catalog year ${catalogYear} is not supported in Academic_Catalog`});
        }
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
};

// POST /auth/login
exports.login = async(req, res) => {
    const {username, password} = req.body;

    if(!username || !password){
        return res.status(400).json({error: 'Username and password are required'});
    }

    const conn = await pool.getConnection();
    try{
        const [rows] = await conn.query(
            `select u.*, s.student_id, s.major, a.User_ID as admin_id, d.User_ID as dev_id
            from user u
            left join student s on u.User_ID = s.user_id
            left join admin a on u.User_ID = a.User_ID
            left join dev d on u.User_ID = d.User_ID
            where u.Username = ?`,
            [username]
        );

        if(rows.length === 0){
            return res.status(401).json({error: 'Invalid credentials'});
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.Password);

        if(!isMatch){
            return res.status(401).json({error: 'Invalid credentials'});
        }

        await conn.query(`update user set Last_Visited = now() where User_ID = ?`, [user.User_ID]);

        const role = user.dev_id ? 'dev' : (user.admin_id ? 'admin' : 'user');

        const token = jwt.sign(
            {
                user_id: user.User_ID,
                username: user.Username,
                student_id: user.student_id,
                role: role
            },
            JWT_SECRET, {expiresIn: '1d'}
        );

        res.json({
            message: 'Login successful',
            token,
            profile: {
                username: user.Username,
                student_id: user.student_id,
                major: user.major,
                role: role
            }
        });
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
}