const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // รูปแบบ "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
};

exports.requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Admin role required' });
    }
    next();
};

exports.requireDev = (req, res, next) => {
    if (!req.user || req.user.role !== 'dev') {
        return res.status(403).json({ error: 'Access denied: Dev role required' });
    }
    next();
};

exports.verifyOwnerOrAdmin = (req, res, next) => {
    const requestedStudentId = req.params.id || req.params.student_id;

    if (req.user.role === 'admin') {
        if (req.method === 'GET') {
            return next();
        }
        return res.status(403).json({ error: 'Access denied: Admin can view student data but cannot modify it' });
    }

    if (String(req.user.student_id) !== String(requestedStudentId)) {
        return res.status(403).json({ error: 'Access denied: You can only access your own data' });
    }

    next();
};

