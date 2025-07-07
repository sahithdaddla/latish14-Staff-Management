-- Create the database
CREATE DATABASE staff_management;

-- Create the employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    emp_id VARCHAR(7) UNIQUE NOT NULL,
    email VARCHAR(64) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    joining_date DATE NOT NULL,
    training VARCHAR(10) NOT NULL,
    project_status VARCHAR(20) NOT NULL,
    project_name VARCHAR(50)
);
