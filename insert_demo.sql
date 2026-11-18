USE GoDegree;

INSERT INTO User (Username, Password, Account_Status) VALUES
('demo_user',  '$2b$10$xpHjJpcYC6HDy9hsaX.yKOXBjQy17hfErzASCsJNtYeQglWR1YvH.',  'Normal'),
('demo_admin', '$2b$10$Fd.wkNgeEEqPE35Fx1up9Obdz/AicwQlaMY8N68X4fSRjIkFxp85y', 'Normal');

SET @demo_user_id  = (SELECT User_ID FROM User WHERE Username = 'demo_user');
SET @demo_admin_id = (SELECT User_ID FROM User WHERE Username = 'demo_admin');

INSERT INTO Student (Student_ID, User_ID, Catalog_Year, Major, Eng_Test_Type, Eng_Score, Eng_Status, Study_Track, Study_Option, Current_Semester)
VALUES (6700000001, @demo_user_id, 2024, 'Digital Engineering', 'IELTS', 7.5, 'Pass', 'Extended Training', 'Data Science', '1');

INSERT INTO Enrollment (Student_ID, Course_Code, Academic_Year, Semester_No, Grade_Earned) VALUES
(6700000001, 'GTS101', 2024, 1, 'ACC'),
(6700000001, 'GTS123', 2024, 1, 'B'),
(6700000001, 'MAS116', 2024, 1, 'B'),
(6700000001, 'SCS141', 2024, 1, 'A'),
(6700000001, 'TU100', 2024, 1, 'A'),
(6700000001, 'TU106', 2024, 1, 'A'),
(6700000001, 'CSS224', 2024, 2, 'B'),
(6700000001, 'DES102', 2024, 2, 'C'),
(6700000001, 'DES103', 2024, 2, 'C'),
(6700000001, 'GTS124', 2024, 2, 'A'),
(6700000001, 'GTS131', 2024, 2, 'B'),
(6700000001, 'TU108', 2024, 2, 'A'),
(6700000001, 'DES201', 2025, 1, 'A'),
(6700000001, 'DES221', 2025, 1, 'B+'),
(6700000001, 'DES231', 2025, 1, 'A'),
(6700000001, 'EES270', 2025, 1, 'A'),
(6700000001, 'EES271', 2025, 1, 'B'),
(6700000001, 'GTS231', 2025, 1, 'A'),
(6700000001, 'LAS101', 2025, 1, 'B'),
(6700000001, 'CSS221', 2025, 2, 'B+'),
(6700000001, 'CSS225', 2025, 2, 'A'),
(6700000001, 'CSS332', 2025, 2, 'A'),
(6700000001, 'DES227', 2025, 2, 'B+'),
(6700000001, 'DES229', 2025, 2, 'A'),
(6700000001, 'GTS210', 2025, 2, 'A'),
(6700000001, 'CSS322', 2026, 1, NULL),
(6700000001, 'CSS324', 2026, 1, NULL),
(6700000001, 'CSS325', 2026, 1, NULL);

INSERT INTO Student_Target_Honor (Student_ID, Honor_Type) VALUES (6700000001, 'Second Class Honors');

INSERT INTO Admin (User_ID) VALUES (@demo_admin_id);

-- Dev
INSERT INTO User (Username, Password, Account_Status) VALUES
('demo_dev', '$2b$10$7kboBMOd3ZMC6mGk4qwaVOQ5NJnok.ojYG7YuUxylBtMLPT6M.hJC', 'Normal');
INSERT INTO Dev (User_ID) SELECT User_ID FROM User WHERE Username = 'demo_dev';
