const express = require('express');
const path = require('path');
require('dotenv').config();

const studentRouter = require('./routes/student');
const courseRouter = require('./routes/course');
const dashboardRouter = require('./routes/dashboard');
const planRouter = require('./routes/plan');
const authRouter = require('./routes/auth');
const { verifyToken } = require('./middleware/auth');
const adminRouter = require('./routes/admin');
const devRouter = require('./routes/dev');
const { requestLogger } = require('./middleware/requestLogger');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(requestLogger);

app.use('/student', verifyToken, studentRouter);
app.use('/course', verifyToken, courseRouter);
app.use('/dashboard', verifyToken, dashboardRouter);
app.use('/plan', verifyToken, planRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/dev', devRouter);


app.use((req, res) => res.status(404).json({ error: 'not found' }));
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in .env');
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Godegree server is running on http://localhost:${PORT}`)
});