use godegree;

-- For each semester
drop procedure if exists count_course;
delimiter //
create procedure count_course(in p_student bigint, in p_academic_year int, in p_semester_no int, out p_count_course int)
begin
	select count(*) into p_count_course from enrollment 
    where student_id = p_student
    and academic_year = p_academic_year
    and semester_no = p_semester_no
    and Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'ACC');
end //
delimiter ;

drop procedure if exists total_course;
delimiter //
create procedure total_course(in p_student bigint, out p_total_course int)
begin
	select count(*) into p_total_course from enrollment 
    where student_id = p_student 
    and Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'ACC');
end //
delimiter ;

-- For each semester
drop procedure if exists count_credit;
delimiter //
create procedure count_credit(in p_student bigint, in p_academic_year int, in p_semester_no int, out p_count_credit int)
begin
	select ifnull(sum(c.credit), 0) into p_count_credit from enrollment e
    join course c on e.Course_Code = c.Course_Code
    where student_id = p_student
    and academic_year = p_academic_year
    and semester_no = p_semester_no
    and e.Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'ACC');
end //
delimiter ;

drop procedure if exists total_credit;
delimiter //
create procedure total_credit(in p_student bigint, out p_total_credit int)
begin
	select ifnull(sum(c.credit), 0) into p_total_credit from enrollment e
    join course c on e.Course_Code = c.Course_Code
    where student_id = p_student
    and e.Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'ACC');
end //
delimiter ;

drop procedure if exists calculate_cgpa;
delimiter //
create procedure calculate_cgpa(in p_student bigint, out p_cgpa decimal(3,2))
begin
	select ifnull(sum(c.credit * case 
		when e.grade_earned='A' then 4.0
		when e.grade_earned='B+' then 3.5
        when e.grade_earned='B' then 3.0
        when e.grade_earned='C+' then 2.5
        when e.grade_earned='C' then 2.0
        when e.grade_earned='D+' then 1.5
        when e.grade_earned='D' then 1.0
        when e.grade_earned='F' then 0.0 end)/ nullif(sum(c.credit), 0), 0.00) into p_cgpa from enrollment e
    join course c on e.Course_Code = c.Course_Code
    where student_id = p_student and e.Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F');
end //
delimiter ;

drop procedure if exists calculate_gpa;
delimiter //
create procedure calculate_gpa(in p_student bigint, in p_academic_year int, in p_semester_no int, out p_gpa decimal(3,2))
begin
	select ifnull(sum(c.credit * case 
		when e.grade_earned='A' then 4.0
		when e.grade_earned='B+' then 3.5
        when e.grade_earned='B' then 3.0
        when e.grade_earned='C+' then 2.5
        when e.grade_earned='C' then 2.0
        when e.grade_earned='D+' then 1.5
        when e.grade_earned='D' then 1.0
        when e.grade_earned='F' then 0.0 end)/ nullif(sum(c.credit), 0), 0.00) into p_gpa from enrollment e
    join course c on e.Course_Code = c.Course_Code
    where student_id = p_student 
    and academic_year = p_academic_year
    and semester_no = p_semester_no
    and e.Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F')
    ;
end //
delimiter ;

drop procedure if exists academic_status;
delimiter //
create procedure academic_status(in p_student bigint, in p_previous_status VARCHAR(20), out p_status VARCHAR(20))
begin
	declare v_completed_semesters int default 0;
	declare v_cgpa decimal(3,2) default 0.00;
    
    call calculate_cgpa(p_student, v_cgpa);
    
    select count(distinct academic_year, semester_no) into v_completed_semesters from enrollment
    where student_id = p_student and grade_earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F');
    if v_completed_semesters = 0 then 
		set p_status = 'Normal';
    elseif v_cgpa >= 2.00 then 
		set p_status = 'Normal';
    else
		if v_completed_semesters <= 2 and v_cgpa < 1.50 then
			set p_status = 'Retired';
		elseif v_completed_semesters = 1 then
			set p_status = 'Warning';
		elseif p_previous_status = 'Normal' or p_previous_status is null then
			set p_status = 'Warning 1';
		elseif p_previous_status in ('Warning', 'Warning 1') then 
			set p_status = 'Warning 2';
		elseif p_previous_status = 'Warning 2' then 
			set p_status = 'Probation';
		elseif p_previous_status = 'Probation' then 
			set p_status = 'Retired';
		else
			set p_status = p_previous_status;
		end if;
	end if;
end //
delimiter ;

drop procedure if exists count_completed_sem;
delimiter //
create procedure count_completed_sem(in p_student bigint, out p_completed_sem int)
begin
	select ifnull(count(distinct academic_year, semester_no), 0) into p_completed_sem
    from enrollment
    where student_id = p_student
    and grade_earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F');
end //
delimiter ;

drop procedure if exists check_eng_score;
delimiter //
create procedure check_eng_score(in p_student bigint,in p_eng_score decimal(5,2), in p_test_type VARCHAR(20), out p_eng_status VARCHAR(5))
begin
	if p_test_type = 'IELTS' and p_eng_score >= 6.0 then
		set p_eng_status = 'Pass';
	elseif p_test_type = 'TU-GET_PBT' and p_eng_score >= 500 then
        set p_eng_status = 'Pass';
    elseif p_test_type = 'TU-GET_CBT' and p_eng_score >= 73 then
        set p_eng_status = 'Pass';
    elseif p_test_type = 'TOEFL_ITP' and p_eng_score >= 500 then
        set p_eng_status = 'Pass';
    elseif p_test_type = 'TOEFL_IBT' and p_eng_score >= 61 then
        set p_eng_status = 'Pass';
    elseif p_test_type = 'TOEIC' and p_eng_score >= 650 then
        set p_eng_status = 'Pass';
    elseif p_test_type = 'CAMBRIDGE' and p_eng_score >= 173 then
        set p_eng_status = 'Pass';
    elseif p_test_type = 'CEFR' and p_eng_score >= 59 then
        set p_eng_status = 'Pass';
    else
        set p_eng_status = 'Fail';
    end if;
    
    update student 
    set Eng_Test_Type = p_test_type, 
        Eng_Score = p_eng_score,
        Eng_Status = p_eng_status
	where student_id = p_student;
end //
delimiter ;

drop procedure if exists calculate_min_target_gpa;
delimiter //
create procedure calculate_min_target_gpa(
    in p_student_id bigint,
    in p_academic_year int,
    in p_semester_no int
)
begin
    declare v_target_cgpa decimal(3,2) default 0.00;
    declare v_past_credits int default 0;
    declare v_past_points decimal(8,2) default 0.00;
    declare v_current_credits int default 0;
    declare v_needed_points decimal(8,2) default 0.00;
    declare v_min_target_gpa decimal(5,2) default 0.00;

    -- ดึงเ cgpa
    select h.min_cgpa into v_target_cgpa
    from student_target_honor sth
    join honor h on sth.honor_type = h.honor_type
    where sth.student_id = p_student_id
    limit 1;

    if v_target_cgpa is not null and v_target_cgpa > 0.00 then
        -- คิดหน่วยกิตและแต้มสะสมจากวิชาทั้งหมด ที่เกรดออกแล้ว
        select 
            ifnull(sum(c.credit), 0),
            ifnull(sum(c.credit * case 
                when e.grade_earned = 'A' then 4.0
                when e.grade_earned = 'B+' then 3.5
                when e.grade_earned = 'B' then 3.0
                when e.grade_earned = 'C+' then 2.5
                when e.grade_earned = 'C' then 2.0
                when e.grade_earned = 'D+' then 1.5
                when e.grade_earned = 'D' then 1.0
                when e.grade_earned = 'F' then 0.0 
                else 0.0 end
            ), 0.00)
        into v_past_credits, v_past_points
        from enrollment e
        join course c on e.course_code = c.course_code
        where e.student_id = p_student_id
          and e.grade_earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F')
          and not (e.academic_year = p_academic_year and e.semester_no = p_semester_no);

        -- คิดหน่วยกิตที่ลงเรียนใน เทอมปัจจุบัน
        select ifnull(sum(c.credit), 0) into v_current_credits
        from enrollment e
        join course c on e.course_code = c.course_code
        where e.student_id = p_student_id 
          and e.academic_year = p_academic_year 
          and e.semester_no = p_semester_no;

        -- คิดเกรดขั้นต่ำที่ต้องทำให้ได้ในเทอมนี้
        if v_current_credits > 0 then
            set v_needed_points = (v_target_cgpa * (v_past_credits + v_current_credits)) - v_past_points;
            set v_min_target_gpa = v_needed_points / v_current_credits;
        end if;
    end if;
	
    
    select v_min_target_gpa as min_target_semester_gpa;
end //
delimiter ;


drop procedure if exists check_honor_eligibility;
delimiter //
create procedure check_honor_eligibility(
    in p_student_id bigint,
    out p_eligible_honor VARCHAR(50)
)
begin
    declare v_cgpa decimal(3,2) default 0.00;
    declare v_major_cgpa decimal(3,2) default 0.00;
    
    declare v_has_f_u int default 0;
    declare v_max_repeated_course int default 0;
    declare v_total_regular_semesters int default 0;
    
    declare v_has_lower_c_all int default 0;
    declare v_has_lower_c_major int default 0;

    select CGPA into v_cgpa from Student 
    where Student_ID = p_student_id;

    select ifnull(sum(c.Credit * case 
        when e.Grade_Earned = 'A' then 4.0
        when e.Grade_Earned = 'B+' then 3.5
        when e.Grade_Earned = 'B' then 3.0
        when e.Grade_Earned = 'C+' then 2.5
        when e.Grade_Earned = 'C' then 2.0
        when e.Grade_Earned = 'D+' then 1.5
        when e.Grade_Earned = 'D' then 1.0
        when e.Grade_Earned = 'F' then 0.0 end) / nullif(sum(c.Credit), 0), 0.00)
    into v_major_cgpa from Enrollment e
    join Course c on e.Course_Code = c.Course_Code
    where e.Student_ID = p_student_id 
      and c.Course_Type = 'Core'
      and e.Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F');
	--  ห้าม F, U
    select COUNT(*) into v_has_f_u from Enrollment 
    where Student_ID = p_student_id 
    and Grade_Earned in ('F', 'U');
    -- ห้ามรีเกรด
    select IFNULL(MAX(course_count), 0) into v_max_repeated_course
    from (
        select count(Course_Code) as course_count from Enrollment 
        where Student_ID = p_student_id 
        and Grade_Earned != 'W'
        group by Course_Code
    ) subquery;
    -- ห้ามเรียนเกิน 4 
    select count(distinct Academic_Year, Semester_No) into v_total_regular_semesters from Enrollment
    where Student_ID = p_student_id 
    and Semester_No in (1, 2);
	-- ห้ามต่ำกว่า c
    select count(*) into v_has_lower_c_all from Enrollment 
    where Student_ID = p_student_id 
    and Grade_Earned in ('D+', 'D');
 
    -- ต่ำกว่า C เฉพาะในวิชาแกน/เอก
    select count(*) into v_has_lower_c_major from Enrollment e
    join Course c on e.Course_Code = c.Course_Code
    where e.Student_ID = p_student_id 
    and c.Course_Type = 'Core' 
    and e.Grade_Earned in ('D+', 'D');

    -- ประมวลผลลัพธ์เกียรตินิยมตามเกณฑ์
    if v_has_f_u > 0 or v_max_repeated_course > 1 or v_total_regular_semesters > 8 then
        -- ถิดข้อใดข้อหนึ่ง อดเกียรตินิยม
        set p_eligible_honor = 'None';
    else
        -- เช็ก First Class Honors CGPA >= 3.50 และไม่มีวิชาไหนต่ำกว่า C
        if v_cgpa >= 3.50 and v_has_lower_c_all = 0 then
            set p_eligible_honor = 'First Class Honors';
            
        -- เช็ก Second Class Honors  ทางแรก CGPA >= 3.50, มีวิชาต่ำกว่า C, แต่ Major CGPA >= 2.00
        elseif v_cgpa >= 3.50 and v_has_lower_c_all > 0 and v_major_cgpa >= 2.00 then
            set p_eligible_honor = 'Second Class Honors';
            
        -- เช็ก Second Class Honors ทางที่สอง CGPA >= 3.25 และวิชาเอกต้องไม่ต่ำกว่า C
        elseif v_cgpa >= 3.25 and v_has_lower_c_major = 0 then
            set p_eligible_honor = 'Second Class Honors';
            
        -- ไม่ผ่านเเลย
        else
            set p_eligible_honor = 'None';
        end if;
    end if;

end //
delimiter ;

drop procedure if exists check_honor_achievable;
delimiter //
create procedure check_honor_achievable(
    in p_student_id bigint,
    out p_max_honor VARCHAR(50)
)
begin
    declare v_graded_credits int default 0;
    declare v_points decimal(8,2) default 0.00;
    declare v_total_credit int default 0;
    declare v_remaining int default 0;
declare v_best_cgpa decimal(5,3) default 0.000;
    declare v_has_f_u int default 0;
    declare v_max_repeated_course int default 0;
    declare v_total_regular_semesters int default 0;
    declare v_has_lower_c_all int default 0;
    declare v_has_lower_c_major int default 0;
    declare v_major_cgpa decimal(3,2) default 0.00;

    select ifnull(Total_Credit, 0) into v_total_credit from Student
    where Student_ID = p_student_id;

    select ifnull(sum(c.Credit), 0),
           ifnull(sum(c.Credit * case
               when e.Grade_Earned = 'A' then 4.0
               when e.Grade_Earned = 'B+' then 3.5
               when e.Grade_Earned = 'B' then 3.0
               when e.Grade_Earned = 'C+' then 2.5
               when e.Grade_Earned = 'C' then 2.0
               when e.Grade_Earned = 'D+' then 1.5
               when e.Grade_Earned = 'D' then 1.0
               else 0.0 end), 0.00)
    into v_graded_credits, v_points
    from Enrollment e
    join Course c on e.Course_Code = c.Course_Code
    where e.Student_ID = p_student_id
      and e.Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F');

    select ifnull(sum(c.Credit * case
        when e.Grade_Earned = 'A' then 4.0
        when e.Grade_Earned = 'B+' then 3.5
        when e.Grade_Earned = 'B' then 3.0
        when e.Grade_Earned = 'C+' then 2.5
        when e.Grade_Earned = 'C' then 2.0
        when e.Grade_Earned = 'D+' then 1.5
        when e.Grade_Earned = 'D' then 1.0
        when e.Grade_Earned = 'F' then 0.0 end) / nullif(sum(c.Credit), 0), 0.00)
    into v_major_cgpa from Enrollment e
    join Course c on e.Course_Code = c.Course_Code
    where e.Student_ID = p_student_id
      and c.Course_Type = 'Core'
      and e.Grade_Earned in ('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F');

    select count(*) into v_has_f_u from Enrollment
		where Student_ID = p_student_id and Grade_Earned in ('F', 'U');
    select ifnull(max(course_count), 0) into v_max_repeated_course
    from (
        select count(Course_Code) as course_count from Enrollment
        where Student_ID = p_student_id and Grade_Earned != 'W'
        group by Course_Code
    ) subquery;

    select count(distinct Academic_Year, Semester_No) into v_total_regular_semesters from Enrollment
    where Student_ID = p_student_id and Semester_No in (1, 2);

    select count(*) into v_has_lower_c_all from Enrollment
    where Student_ID = p_student_id and Grade_Earned in ('D+', 'D');

    select count(*) into v_has_lower_c_major from Enrollment e
    join Course c on e.Course_Code = c.Course_Code
    where e.Student_ID = p_student_id and c.Course_Type = 'Core'
      and e.Grade_Earned in ('D+', 'D');

    set v_remaining = greatest(136 - v_total_credit, 0);
    set v_best_cgpa = (v_points + 4.0 * v_remaining) / nullif(v_graded_credits + v_remaining, 0);
    set v_best_cgpa = ifnull(v_best_cgpa, 0.000);

    if v_has_f_u > 0 or v_max_repeated_course > 1 or v_total_regular_semesters > 8 then
        set p_max_honor = 'None';
    elseif v_best_cgpa >= 3.50 and v_has_lower_c_all = 0 then
        set p_max_honor = 'First Class Honors';
    elseif v_best_cgpa >= 3.50 and v_major_cgpa >= 2.00 then
        set p_max_honor = 'Second Class Honors';
    elseif v_best_cgpa >= 3.25 and v_has_lower_c_major = 0 then
        set p_max_honor = 'Second Class Honors';
else
        set p_max_honor = 'None';
    end if;
end //
delimiter ;	