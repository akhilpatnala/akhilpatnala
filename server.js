const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('shift_roster.db');

// Initialize database tables
db.serialize(() => {
    // Create employees table
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        employee_id TEXT UNIQUE NOT NULL
    )`);

    // Create shifts table
    db.run(`CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        FOREIGN KEY (employee_id) REFERENCES employees (id)
    )`);

    // Insert default employees if table is empty
    db.get("SELECT COUNT(*) as count FROM employees", (err, row) => {
        if (row && row.count === 0) {
            const defaultEmployees = [
                'John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown',
                'Lisa Davis', 'Tom Miller', 'Emma Garcia', 'Chris Rodriguez', 'Anna Martinez',
                'Kevin Lee', 'Maria Taylor', 'James Anderson', 'Sophia Thomas', 'Robert Jackson'
            ];
            
            defaultEmployees.forEach((name, index) => {
                db.run("INSERT INTO employees (name, employee_id) VALUES (?, ?)", 
                    [name, `EMP${String(index + 1).padStart(3, '0')}`]);
            });
        }
    });
});

// API Routes

// Get all employees
app.get('/api/employees', (req, res) => {
    db.all("SELECT * FROM employees ORDER BY name", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get shifts for a specific month
app.get('/api/shifts/:year/:month', (req, res) => {
    const { year, month } = req.params;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    db.all(`
        SELECT s.*, e.name, e.employee_id as emp_id
        FROM shifts s
        JOIN employees e ON s.employee_id = e.id
        WHERE s.date >= ? AND s.date <= ?
        ORDER BY s.date, e.name
    `, [startDate, endDate], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add or update shift
app.post('/api/shifts', (req, res) => {
    const { employee_id, date, shift_type } = req.body;
    
    // Check if shift already exists for this employee and date
    db.get("SELECT id FROM shifts WHERE employee_id = ? AND date = ?", 
        [employee_id, date], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            // Update existing shift
            db.run("UPDATE shifts SET shift_type = ? WHERE id = ?", 
                [shift_type, row.id], function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Shift updated successfully', id: row.id });
            });
        } else {
            // Insert new shift
            db.run("INSERT INTO shifts (employee_id, date, shift_type) VALUES (?, ?, ?)", 
                [employee_id, date, shift_type], function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ message: 'Shift added successfully', id: this.lastID });
            });
        }
    });
});

// Get shift summary for a month
app.get('/api/summary/:year/:month', (req, res) => {
    const { year, month } = req.params;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    db.all(`
        SELECT 
            e.id,
            e.name,
            e.employee_id as emp_id,
            COUNT(s.id) as total_shifts,
            SUM(CASE WHEN s.shift_type = 'S1' THEN 1 ELSE 0 END) as s1_count,
            SUM(CASE WHEN s.shift_type = 'S2' THEN 1 ELSE 0 END) as s2_count,
            SUM(CASE WHEN s.shift_type = 'S3' THEN 1 ELSE 0 END) as s3_count,
            SUM(CASE WHEN s.shift_type = 'S4' THEN 1 ELSE 0 END) as s4_count,
            SUM(CASE WHEN s.shift_type = 'S5' THEN 1 ELSE 0 END) as s5_count
        FROM employees e
        LEFT JOIN shifts s ON e.id = s.employee_id AND s.date >= ? AND s.date <= ?
        GROUP BY e.id, e.name, e.employee_id
        ORDER BY e.name
    `, [startDate, endDate], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Calculate amounts
        const shiftRates = { S1: 400, S2: 300, S3: 900, S4: 500, S5: 600 };
        
        rows.forEach(row => {
            row.total_amount = (row.s1_count * shiftRates.S1) + 
                              (row.s2_count * shiftRates.S2) + 
                              (row.s3_count * shiftRates.S3) + 
                              (row.s4_count * shiftRates.S4) + 
                              (row.s5_count * shiftRates.S5);
        });
        
        res.json(rows);
    });
});

// Delete shift
app.delete('/api/shifts/:id', (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM shifts WHERE id = ?", [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Shift deleted successfully' });
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});