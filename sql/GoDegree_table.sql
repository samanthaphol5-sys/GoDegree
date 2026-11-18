DROP DATABASE IF EXISTS GoDegree;
CREATE DATABASE GoDegree;
USE GoDegree;

CREATE TABLE `User` (
    User_ID         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    Username        VARCHAR(25)   NOT NULL UNIQUE,
    Password        VARCHAR(255)  NOT NULL,
    Account_Status  ENUM('Normal') NOT NULL,
    Date_Created    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Last_Visited    DATETIME      NULL,
    PRIMARY KEY (User_ID)
);

CREATE TABLE Academic_Catalog (
    Catalog_Year  VARCHAR(10)   NOT NULL,
    File_Name     VARCHAR(255)  NOT NULL,
    File_URL      VARCHAR(255)  NULL,
    PRIMARY KEY (Catalog_Year)
);

CREATE TABLE Student (
    Student_ID        BIGINT        NOT NULL,
    User_ID           INT UNSIGNED  NOT NULL UNIQUE,
    Catalog_Year      VARCHAR(10)   NOT NULL,
    Major             VARCHAR(100)  NOT NULL,
    Eng_Test_Type     ENUM('IELTS','TU-GET_PBT','TU-GET_CBT','TOEFL_ITP',
                           'TOEFL_IBT','TOEIC','CAMBRIDGE','CEFR') NULL,
    Eng_Score         DECIMAL(5,2)  NULL default 0,
    Eng_Status        ENUM('Pass','Fail') NOT NULL default 'Fail',
    Study_Track       ENUM('Senior Project','Extended Training', 'Overseas Exchange') NULL,
    Study_Option      ENUM('Data Science','Application Software Development', 'General Digital Engineering') NULL,
    Current_Semester  ENUM('1','2', '3') NOT NULL,
    Academic_Status   ENUM('Normal','Warning','Warning 1','Warning 2','Probation', 'Retired') NOT NULL default 'Normal',
    CGPA              DECIMAL(3,2)  NULL,
    Total_Courses     INT           NULL,
    Total_Credit      INT           NULL,
    PRIMARY KEY (Student_ID),
    FOREIGN KEY (User_ID) REFERENCES `User`(User_ID),
    FOREIGN KEY (Catalog_Year) REFERENCES Academic_Catalog(Catalog_Year),
    CHECK (Eng_Score BETWEEN 0.00 AND 999.99),
    CHECK (CGPA BETWEEN 0.00 AND 4.00)
);

CREATE TABLE Admin (
    User_ID  INT UNSIGNED NOT NULL,
    PRIMARY KEY (User_ID),
    FOREIGN KEY (User_ID) REFERENCES `User`(User_ID)
);

CREATE TABLE Dev (
    User_ID  INT UNSIGNED NOT NULL,
    PRIMARY KEY (User_ID),
    FOREIGN KEY (User_ID) REFERENCES `User`(User_ID)
);

CREATE TABLE Course (
    Course_Code    VARCHAR(10)   NOT NULL,
    Course_Name    VARCHAR(100)  NOT NULL,
    Credit         INT           NOT NULL,
    Course_Type    ENUM('Core','Elective') NOT NULL,
    Schedule       VARCHAR(100)  NULL,
    PRIMARY KEY (Course_Code)
);

CREATE TABLE Prerequisite (
    Course_Code   VARCHAR(10)  NOT NULL,
    Prereq_Code   VARCHAR(10)  NOT NULL,
    PRIMARY KEY (Course_Code, Prereq_Code),
    FOREIGN KEY (Course_Code) REFERENCES Course(Course_Code),
    FOREIGN KEY (Prereq_Code) REFERENCES Course(Course_Code),
    CHECK (Course_Code <> Prereq_Code)
);

CREATE TABLE Semester (
    Academic_Year  INT NOT NULL,
    Semester_No    INT NOT NULL,
    PRIMARY KEY (Academic_Year, Semester_No)
);

CREATE TABLE Enrollment (
    Student_ID     BIGINT       NOT NULL,
    Course_Code    VARCHAR(10)  NOT NULL,
    Academic_Year  INT          NOT NULL,
    Semester_No    INT          NOT NULL,
    Grade_Earned ENUM('A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'ACC', 'W') NULL,
    PRIMARY KEY (Student_ID, Course_Code, Academic_Year, Semester_No),
    FOREIGN KEY (Student_ID) REFERENCES Student(Student_ID),
    FOREIGN KEY (Course_Code) REFERENCES Course(Course_Code),
    FOREIGN KEY (Academic_Year, Semester_No) REFERENCES Semester(Academic_Year, Semester_No)
);

CREATE TABLE Honor (
    Honor_Type      enum('First Class Honors', 'Second Class Honors')   NOT NULL,
    Min_CGPA        DECIMAL(3,2)  NOT NULL,
    Min_Major_CGPA  DECIMAL(3,2)  NULL,
    Min_Grade_All   VARCHAR(2)    NULL,
    Min_Grade_Maj   VARCHAR(2)    NOT NULL,
    F_Grade         VARCHAR(1)    NOT NULL,
    U_Grade         VARCHAR(1)    NOT NULL,
    PRIMARY KEY (Honor_Type),
    CHECK (Min_CGPA BETWEEN 0.00 AND 4.00),
    CHECK (Min_Major_CGPA BETWEEN 0.00 AND 4.00)
);

CREATE TABLE Student_Target_Honor (
    Student_ID  BIGINT       NOT NULL,
    Honor_Type  enum('First Class Honors', 'Second Class Honors')  NULL,
    PRIMARY KEY (Student_ID),
    FOREIGN KEY (Student_ID) REFERENCES Student(Student_ID),
    FOREIGN KEY (Honor_Type) REFERENCES Honor(Honor_Type)
);

SHOW TABLES;
