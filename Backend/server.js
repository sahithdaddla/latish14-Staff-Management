const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = 3090;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection configuration
const pool = new Pool({
    user: 'postgres', // Replace with your PostgreSQL username
    host: 'postgres',
    database: 'staff_management',
    password: 'admin123', // Replace with your PostgreSQL password
    port: 5432,
});

// Validation functions
function validateName(name) {
    if (!name) return false;
    const nameRegex = /^[A-Za-z][A-Za-z\s]*$/;
    const alphaCount = name.replace(/[^A-Za-z]/g, '').length;
    return name.length <= 50 && alphaCount >= 5 && nameRegex.test(name);
}

function validateEmployeeId(empId) {
    const empIdRegex = /^ATS0(?!000)\d{3}$/;
    return empIdRegex.test(empId);
}

function validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]{1,64}@astrolitetech\.com$/;
    return emailRegex.test(email);
}

function validateRole(role) {
    if (!role) return false;
    const roleRegex = /^[A-Za-z][A-Za-z\s]*$/;
    const alphaCount = role.replace(/[^A-Za-z]/g, '').length;
    return role.length <= 50 && alphaCount >= 5 && roleRegex.test(role);
}

function validateJoiningDate(dateString) {
    if (!dateString) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateString);
    const minDate = new Date('1950-01-01');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(dateString) && 
           selectedDate <= today && 
           selectedDate >= minDate;
}

function validateTrainingStatus(training) {
    return ['ongoing', 'done'].includes(training);
}

function validateProjectStatus(projectStatus) {
    return ['on-bench', 'in-project'].includes(projectStatus);
}

function validateProjectName(projectName) {
    if (!projectName) return false;
    const projectNameRegex = /^[A-Za-z][A-Za-z\s]*$/;
    const alphaCount = projectName.replace(/[^A-Za-z]/g, '').length;
    return projectName.length <= 50 && alphaCount >= 5 && projectNameRegex.test(projectName);
}

// Helper function to validate employee data
async function validateEmployeeData(employee, isUpdate = false, currentId = null) {
    const errors = [];

    if (!validateName(employee.name)) {
        errors.push('Name: Max 50 chars, min 5 letters');
    }

    if (!validateEmployeeId(employee.emp_id)) {
        errors.push('Employee ID: Format ATS0XXX (X is digit)');
    } else {
        // Check for duplicate employee ID
        const empIdCheck = await pool.query(
            'SELECT emp_id FROM employees WHERE emp_id = $1 AND ($2::integer IS NULL OR id != $2)',
            [employee.emp_id, currentId]
        );
        if (empIdCheck.rows.length > 0) {
            errors.push('Employee ID already exists');
        }
    }

    if (!validateEmail(employee.email)) {
        errors.push('Email: Max 64 chars before @astrolitetech.com');
    } else {
        // Check for duplicate email
        const emailCheck = await pool.query(
            'SELECT email FROM employees WHERE email = $1 AND ($2::integer IS NULL OR id != $2)',
            [employee.email, currentId]
        );
        if (emailCheck.rows.length > 0) {
            errors.push('Email already exists');
        }
    }

    if (!validateRole(employee.role)) {
        errors.push('Role: Max 50 chars, min 5 letters');
    }

    if (!validateJoiningDate(employee.joining_date)) {
        errors.push('Joining Date: Must be between 1950 and today');
    }

    if (!validateTrainingStatus(employee.training)) {
        errors.push('Training Status: Must be "ongoing" or "done"');
    }

    if (!validateProjectStatus(employee.project_status)) {
        errors.push('Project Status: Must be "on-bench" or "in-project"');
    }

    if (employee.project_status === 'in-project' && !validateProjectName(employee.project_name)) {
        errors.push('Project Name: Max 50 chars, min 5 letters');
    }

    return errors;
}

// API Endpoints

// Get all employees
app.get('/api/employees', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM employees ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get employee by ID
app.get('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new employee
app.post('/api/employees', async (req, res) => {
    const employee = req.body;
    const errors = await validateEmployeeData(employee);

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        const result = await pool.query(
            `INSERT INTO employees (name, emp_id, email, role, joining_date, training, project_status, project_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                employee.name,
                employee.emp_id,
                employee.email,
                employee.role,
                employee.joining_date,
                employee.training,
                employee.project_status,
                employee.project_status === 'in-project' ? employee.project_name : null
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update an employee
app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const employee = req.body;
    const errors = await validateEmployeeData(employee, true, id);

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        const result = await pool.query(
            `UPDATE employees 
             SET name = $1, emp_id = $2, email = $3, role = $4, joining_date = $5, 
                 training = $6, project_status = $7, project_name = $8
             WHERE id = $9
             RETURNING *`,
            [
                employee.name,
                employee.emp_id,
                employee.email,
                employee.role,
                employee.joining_date,
                employee.training,
                employee.project_status,
                employee.project_status === 'in-project' ? employee.project_name : null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete an employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM employees WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({ message: 'Employee deleted successfully' });
    } catch (err) {
        console.error(err.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://13.60.252.56:${port}`);
});

// Initialize database table
async function initializeDatabase() {
    try {
        await pool.query(`
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
            )
        `);
        console.log('Database table initialized');
    } catch (err) {
        console.error('Error initializing database:', err.stack);
    }
}

initializeDatabase();