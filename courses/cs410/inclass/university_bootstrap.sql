-- =====================================================================
-- CS 410/510 Databases - Fall 2026
-- UNIVERSITY mini-world: bootstrap script
--
-- In-class live SQL session, Mon Oct 5, 2026.
--
-- This file rebuilds the entire in-class database from nothing.
-- Use it to catch up if you missed a step, to reset after you have
-- broken something, or to practice for HW2.
--
--   Run it from the mysql client with:   SOURCE university_bootstrap.sql
--   Or from a shell with:                mysql -u root -p < university_bootstrap.sql
--
-- Running it twice is safe: it drops and recreates everything.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. A clean slate
-- ---------------------------------------------------------------------
DROP DATABASE IF EXISTS university;
CREATE DATABASE university;
USE university;


-- ---------------------------------------------------------------------
-- 1. DDL - define the structure
--
-- Order matters. A table that REFERENCES another must be created after
-- the table it points at.
-- ---------------------------------------------------------------------

CREATE TABLE DEPARTMENT (
    DeptCode   CHAR(4)        NOT NULL,
    DeptName   VARCHAR(40)    NOT NULL,
    Building   VARCHAR(20),
    PRIMARY KEY (DeptCode)
);

CREATE TABLE STUDENT (
    StudentID  CHAR(5)        NOT NULL,
    Name       VARCHAR(40)    NOT NULL,
    Major      CHAR(4),                      -- NULL = undeclared
    GradYear   SMALLINT,
    GPA        DECIMAL(3,2),                 -- NULL = no grades yet
    PRIMARY KEY (StudentID),
    FOREIGN KEY (Major) REFERENCES DEPARTMENT(DeptCode)
);

CREATE TABLE COURSE (
    CourseID   VARCHAR(8)     NOT NULL,
    Title      VARCHAR(50)    NOT NULL,
    Credits    TINYINT        NOT NULL DEFAULT 3,
    DeptCode   CHAR(4)        NOT NULL,
    PRIMARY KEY (CourseID),
    FOREIGN KEY (DeptCode) REFERENCES DEPARTMENT(DeptCode)
);

-- The M:N relationship from the Sep 16 lecture, as its own relation.
-- The primary key is the pair - that is what makes it M:N.
CREATE TABLE ENROLLED_IN (
    StudentID  CHAR(5)        NOT NULL,
    CourseID   VARCHAR(8)     NOT NULL,
    Grade      CHAR(2),                      -- NULL = in progress
    PRIMARY KEY (StudentID, CourseID),
    FOREIGN KEY (StudentID) REFERENCES STUDENT(StudentID),
    FOREIGN KEY (CourseID)  REFERENCES COURSE(CourseID)
);


-- ---------------------------------------------------------------------
-- 2. DML - add the data
--
-- Order matters here too, and for the same reason: a row cannot point
-- at a parent row that does not exist yet.
-- ---------------------------------------------------------------------

INSERT INTO DEPARTMENT (DeptCode, DeptName, Building) VALUES
    ('CS',   'Computer Science',  'CCP'),
    ('MATH', 'Mathematics',       'MB'),
    ('BIOL', 'Biology',           'SCI'),
    ('ENGL', 'English',           'LA');

INSERT INTO STUDENT (StudentID, Name, Major, GradYear, GPA) VALUES
    ('S1001', 'Ana Reyes',      'CS',   2027, 3.72),
    ('S1002', 'Ben Okafor',     'CS',   2026, 3.15),
    ('S1003', 'Chloe Nguyen',   'MATH', 2027, 3.95),
    ('S1004', 'Diego Santos',   'CS',   2028, 2.88),
    ('S1005', 'Emma Larsen',    'BIOL', 2026, 3.40),
    ('S1006', 'Farid Haddad',   'MATH', 2028, 3.61),
    ('S1007', 'Grace Kim',      'CS',   2027, 3.33),
    ('S1008', 'Henry Patel',     NULL,  2029, NULL);   -- undeclared, first semester

INSERT INTO COURSE (CourseID, Title, Credits, DeptCode) VALUES
    ('CS410',   'Databases',               3, 'CS'),
    ('CS321',   'Data Structures',         3, 'CS'),
    ('CS354',   'Programming Languages',   3, 'CS'),
    ('MATH275', 'Linear Algebra',          4, 'MATH'),
    ('BIOL227', 'Genetics',                4, 'BIOL'),
    ('ENGL102', 'Writing and Rhetoric',    3, 'ENGL');

INSERT INTO ENROLLED_IN (StudentID, CourseID, Grade) VALUES
    ('S1001', 'CS410',   'A'),
    ('S1001', 'CS321',   'B+'),
    ('S1001', 'MATH275', 'A-'),
    ('S1002', 'CS410',   'B'),
    ('S1002', 'CS354',   'C+'),
    ('S1003', 'MATH275', 'A'),
    ('S1003', 'CS410',   'A-'),
    ('S1004', 'CS321',   'C'),
    ('S1004', 'CS410',   NULL),              -- in progress
    ('S1005', 'BIOL227', 'B+'),
    ('S1005', 'ENGL102', 'A'),
    ('S1006', 'MATH275', 'B+'),
    ('S1007', 'CS410',   'A-'),
    ('S1007', 'CS354',   'B'),
    ('S1008', 'ENGL102', NULL);              -- in progress


-- ---------------------------------------------------------------------
-- 3. Confirm it worked
-- ---------------------------------------------------------------------
SELECT 'DEPARTMENT' AS TableName, COUNT(*) AS NumRows FROM DEPARTMENT
UNION ALL SELECT 'STUDENT',     COUNT(*) FROM STUDENT
UNION ALL SELECT 'COURSE',      COUNT(*) FROM COURSE
UNION ALL SELECT 'ENROLLED_IN', COUNT(*) FROM ENROLLED_IN;

-- Expected: 4 departments, 8 students, 6 courses, 15 enrollments.
