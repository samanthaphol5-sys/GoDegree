drop trigger if exists enrol_insert;
delimiter //
create trigger enrol_insert
after insert on enrollment
for each row
begin
	declare v_cgpa decimal(3,2);
    declare v_total_courses int;
    declare v_total_credits int;
    declare v_old_status varchar(20);
    declare v_new_status varchar(20);
    
    call calculate_cgpa(new.student_id, v_cgpa);
    call total_course(new.student_id, v_total_courses);
    call total_credit(new.student_id, v_total_credits);
    
    select academic_status into v_old_status from student
	where student_id = new.student_id;
    call academic_status(new.Student_ID, v_old_status, v_new_status);
    
    update student
    set cgpa = v_cgpa,
		Total_Courses = v_total_courses,
        Total_Credit = v_total_credits,
        Academic_Status = v_new_status
    where student_id = new.student_id;
end //
delimiter ;

drop trigger if exists enrol_update;
delimiter //
create trigger enrol_update
after update on enrollment
for each row
begin
	declare v_cgpa decimal(3,2);
    declare v_total_courses int;
    declare v_total_credits int;
    declare v_old_status varchar(20);
    declare v_new_status varchar(20);
    
    call calculate_cgpa(new.student_id, v_cgpa);
    call total_course(new.student_id, v_total_courses);
    call total_credit(new.student_id, v_total_credits);
    
    select academic_status into v_old_status from student
    where student_id = new.student_id;
    call academic_status(new.Student_ID, v_old_status, v_new_status);
     update student
    set cgpa = v_cgpa,
		Total_Courses = v_total_courses,
        Total_Credit = v_total_credits,
        Academic_Status = v_new_status
    where student_id = new.student_id;
end //
delimiter ;

drop trigger if exists enrol_delete;
delimiter //
create trigger enrol_delete
after delete on enrollment
for each row
begin
	declare v_cgpa decimal(3,2);
    declare v_total_courses int;
    declare v_total_credits int;
    declare v_old_status varchar(20);
    declare v_new_status varchar(20);
    
    call calculate_cgpa(OLD.student_id, v_cgpa);
    call total_course(OLD.student_id, v_total_courses);
    call total_credit(OLD.student_id, v_total_credits);
    
    select academic_status into v_old_status from student
    where student_id = OLD.student_id;
    call academic_status(OLD.student_id, v_old_status, v_new_status);
     update student
    set cgpa = v_cgpa,
		Total_Courses = v_total_courses,
        Total_Credit = v_total_credits,
        Academic_Status = v_new_status
    where student_id = OLD.student_id;
end //
delimiter ;