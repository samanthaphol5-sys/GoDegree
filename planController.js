const pool = require('../db');

// GET /plan/student/:id/semester/:year/:sem
exports.getMySemester = async(req, res) => {
    const studentId = Number(req.params.id);
    const year = Number(req.params.year);
    const sem = Number(req.params.sem);

    if(!Number.isInteger(studentId) || !Number.isInteger(year) || !Number.isInteger(sem)) {
        return res.status(400).json({ error: 'Invalid parameters. ID, year, and semester must be integers.' });
    }

    const conn = await pool.getConnection();
    try{
        await conn.query('call check_honor_eligibility(?, @eligible)', [studentId]);
        const [eligibleResult] = await conn.query('SELECT @eligible AS max_eligible_honor');
        const maxEligibleHonor = eligibleResult[0].max_eligible_honor;
       
        await conn.query('call check_honor_achievable(?, @achievable)', [studentId]);
        const [achievableResult] = await conn.query('SELECT @achievable AS max_achievable_honor');
        const maxAchievableHonor = achievableResult[0].max_achievable_honor || 'None';
        
        // target honor
        const [honorRows] = await conn.query(
            `SELECT h.honor_type, h.min_cgpa 
             FROM student_target_honor sth
             JOIN honor h ON sth.honor_type = h.honor_type
             WHERE sth.student_id = ?`,
            [studentId]
        );
        
        let targetHonor = null;
        let minTargetSemesterGpa = 0.00;

        if(honorRows.length > 0){
            const currentTarget = honorRows[0].honor_type;

             if(maxAchievableHonor === 'None' || (currentTarget === 'First Class Honors' && maxAchievableHonor === 'Second ClassHonos')){
                await conn.query('delete from student_target_honor where student_id = ?', [studentId]);
                targetHonor = null;
            }
            else{
                targetHonor = honorRows[0];
                const[gpaRows] = await conn.query('call calculate_min_target_gpa(?, ?, ?)', [studentId, year, sem]);
            
                if(gpaRows && gpaRows[0] && gpaRows[0][0]){
                    minTargetSemesterGpa = gpaRows[0][0].min_target_semester_gpa || 0.00;
                }
            }
        }

        //วิชาที่ลง
        const[course] = await conn.query(
            `select e.course_code, c.course_name, c.credit, e.grade_earned
            from enrollment e
            join course c on e.course_code = c.course_code
            where e.student_id = ?
            and e.academic_year = ?
            and e.semester_no = ?`,
            [studentId, year, sem]
        );

        res.json({
            student_id: studentId,
            academic_year: year,
            semester_no: sem,
            max_eligible_honor: maxEligibleHonor,
            max_achievable_honor: maxAchievableHonor,
            target_honor: targetHonor ? targetHonor.honor_type : 'None',
            min_target_semester_gpa: Number(minTargetSemesterGpa).toFixed(2),
            courses: course
        })
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
};

// POST /plan/student/:id/enrollment
exports.addCourse = async(req, res) => {
    const studentId = Number(req.params.id);
    const {course_code, academic_year, semester_no, grade_earned} = req.body;

    if (!Number.isInteger(studentId) || !course_code || !academic_year || !semester_no) {
        return res.status(400).json({ error: 'Missing or invalid required fields' });
    }

    const conn = await pool.getConnection();
    try{
        await conn.query(
            `insert into enrollment (student_id, course_code, academic_year, semester_no, grade_earned)
            values (?, ?, ?, ?, ?) on duplicate key update grade_earned = values(grade_earned)`,
            [studentId, course_code, academic_year, semester_no, grade_earned || null]
        );
        res.status(201).json({message: 'Course plan updated successfully'});
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
};

// DELETE /plan/student/:id/enrollment/:courseCode
exports.removeCourse = async(req, res) => {
    const studentId = Number(req.params.id);
    const courseCode = req.params.courseCode;
    const academicYear = Number(req.query.academic_year);
    const semesterNo = Number(req.query.semester_no);
    if (!Number.isInteger(studentId) || !courseCode || !Number.isInteger(academicYear) || !Number.isInteger(semesterNo)) {
        return res.status(400).json({ error: 'academic_year and semester_no are required' });
    }
    const conn = await pool.getConnection();
    try{
        const[result] = await conn.query(
            `delete from enrollment 
            where student_id = ?
            and course_code = ?
            and academic_year = ?
            and semester_no = ?`,
            [studentId, courseCode, academicYear, semesterNo]
        );
        if(result.affectedRows === 0){
            return res.status(404).json({ error: 'Course not found in your plan' });
        }
        res.json({message: 'Course removed from plan'});
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
};

// GET /plan/student/:id/all
exports.getAllSemester = async(req, res) => {
    const studentId = Number(req.params.id);

    if(!Number.isInteger(studentId)){
        return res.status(400).json({error: 'Student ID must be an integer'});
    }
    const conn = await pool.getConnection();
    try{
        const[semesters] = await conn.query(
            `select distinct academic_year, semester_no from enrollment
            where student_id = ? order by academic_year asc, semester_no asc`,
            [studentId]
        );

        const graduationPlan = [];

        for(const sem of semesters){
            const year = sem.academic_year;
            const semesterNo = sem.semester_no;

            const[courses] = await conn.query(
                `select e.course_code, c.course_name, c.course_type, c.credit, e.grade_earned
                from enrollment e
                join course c on e.course_code = c.course_code
                where e.student_id = ? and e.academic_year = ?
                and e.semester_no = ?`,
                [studentId, year, semesterNo]
            );

            await conn.query('call calculate_gpa(?, ?, ?, @gpa)', [studentId, year, semesterNo]);
            const [gpaResult] = await conn.query('select @gpa as gpa');
            const gpa = gpaResult[0].gpa || 0.00;

            await conn.query('call count_credit(?, ?, ?, @total_credit)', [studentId, year, semesterNo]);
            const [creditResult] = await conn.query('select @total_credit as total_credit');
            const termCredit = creditResult[0].total_credit || 0;

            graduationPlan.push({
                academic_year: year,
                semester_no: semesterNo,
                gpa: Number(gpa).toFixed(2),
                total_credits: termCredit,
                total_courses: courses.length,
                courses: courses
            });
        }

        const [studentInfo] = await conn.query(
            `select CGPA, Academic_Status, Total_Credit from student 
            where student_id = ?`,
            [studentId]
        );

        const info = studentInfo[0];

        res.json({
            student_id: studentId,
            overall_cgpa: info && info.CGPA != null ? Number(info.CGPA).toFixed(2) : "0.00",
            overall_credits: info ? (info.Total_Credit || 0) : 0,
            academic_status: info ? info.Academic_Status : "Normal",
            plan: graduationPlan
        })
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
    finally{
        conn.release();
    }
};