const pool = require('../db');

// GET /dashboard/:id/progress
exports.getDashboardProgress = async(req, res) => {
    const studentId = Number(req.params.id);
    if(!Number.isInteger(studentId)){
        return res.status(400).json({error:'Student ID must be an integer'});
    }

    const conn = await pool.getConnection();
    try{
        const[rows] = await conn.query(
            'select cgpa, total_credit, eng_status, eng_test_type, eng_score from student where student_id = ?',
        [studentId]
        );

        if(rows.length ===0){
            return res.status(404).json({error: 'Student not found'});
        }

        const student = rows[0];
        const cgpa = student.cgpa || 0.00;
        const totalCredit = student.total_credit || 0;
        const engStatus = student.eng_status || 'Fail';
        const engTestType = student.eng_test_type;
        const engScore = student.eng_score || 0;

        // จน.เทอมที่จบ
        await conn.query(
            'call count_completed_sem(?, @completed_sem)',
            [studentId]
        );
        const [semResult] = await conn.query(
            'select @completed_sem as completed_sem'
        );
        const completedSemesters = semResult[0].completed_sem || 0;

        //calculate progress
        const creditProgress = Math.min((totalCredit/136)*100, 100);
        const semProgress = Math.min((completedSemesters/7)*100, 100);
        const cgpaProgress = Math.min((cgpa/2.00)*100, 100);
        const engProgress = engStatus === 'Pass' ? 100:0;
        const overallProgress = (creditProgress + semProgress + cgpaProgress + engProgress) / 4;

        res.json({
            student_id: studentId,
            overall_progress: Number(overallProgress.toFixed(2)),
            detail:{
                credit:{current: totalCredit, required: 136, progress: Number(creditProgress.toFixed(2))},
                semesters:{current: completedSemesters, required: 7, progress: Number(semProgress.toFixed(2))},
                cgpa:{current: cgpa, required: 2.00, progress: Number(cgpaProgress.toFixed(2))},
                eng:{current: engStatus, progress: engProgress, test_type: engTestType, score: engScore}
            }
        });
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        await conn.release();
    }
};