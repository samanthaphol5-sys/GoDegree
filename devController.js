const pool = require('../db');
const { getLog } = require('../middleware/requestLogger');

// GET /dev/stats
exports.getStats = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT
                COUNT(*)                                                        AS total_users,
                COALESCE(SUM(a.User_ID IS NULL AND d.User_ID IS NULL), 0)       AS total_students,
                COALESCE(SUM(a.User_ID IS NOT NULL), 0)                         AS total_admins,
                COALESCE(SUM(d.User_ID IS NOT NULL), 0)                         AS total_devs,
                COALESCE(SUM(u.Last_Visited >= NOW() - INTERVAL 7 DAY), 0)      AS active_7days,
                COALESCE(SUM(DATE(u.Last_Visited) = CURDATE()), 0)              AS active_today,
                COALESCE(SUM(YEAR(u.Date_Created) = YEAR(NOW())
                         AND MONTH(u.Date_Created) = MONTH(NOW())), 0)          AS new_this_month
             FROM user u
             LEFT JOIN admin a ON a.User_ID = u.User_ID
             LEFT JOIN dev d   ON d.User_ID = u.User_ID`
        );
        const r = rows[0];
        res.json({
            total_users: Number(r.total_users),
            total_students: Number(r.total_students),
            total_admins: Number(r.total_admins),
            total_devs: Number(r.total_devs),
            active_today: Number(r.active_today),
            active_7days: Number(r.active_7days),
            new_this_month: Number(r.new_this_month)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
};

// GET /dev/users  (username, student id, created date, last visit; never the password)
exports.getUsers = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.Username AS username, s.Student_ID AS student_id,
                    CASE WHEN d.User_ID IS NOT NULL THEN 'dev'
                         WHEN a.User_ID IS NOT NULL THEN 'admin'
                         ELSE 'user' END AS role,
                    u.Date_Created, u.Last_Visited
             FROM user u
             LEFT JOIN student s ON u.User_ID = s.User_ID
             LEFT JOIN admin a   ON u.User_ID = a.User_ID
             LEFT JOIN dev d     ON u.User_ID = d.User_ID
             ORDER BY u.Date_Created DESC, u.Username`
        );
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
};

// GET /dev/request-log?limit=100&status=404|4xx
exports.getRequestLog = (req, res) => {
    res.json(getLog({ limit: req.query.limit, status: req.query.status }));
};
