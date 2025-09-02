class ShiftRosterApp {
    constructor() {
        this.currentDate = new Date();
        this.employees = [];
        this.shifts = {};
        this.selectedCell = null;
        
        this.init();
    }

    async init() {
        await this.loadEmployees();
        this.setupEventListeners();
        this.renderRoster();
        this.loadShifts();
        this.updateSummary();
    }

    async loadEmployees() {
        try {
            const response = await fetch('/api/employees');
            this.employees = await response.json();
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }

    setupEventListeners() {
        // Month navigation
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderRoster();
            this.loadShifts();
            this.updateSummary();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderRoster();
            this.loadShifts();
            this.updateSummary();
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentDate = new Date();
            this.renderRoster();
            this.loadShifts();
            this.updateSummary();
        });

        // Modal events
        const modal = document.getElementById('shiftModal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Shift option buttons
        document.querySelectorAll('.shift-option').forEach(button => {
            button.addEventListener('click', () => {
                const shiftType = button.dataset.shift;
                this.assignShift(shiftType);
                modal.style.display = 'none';
            });
        });
    }

    renderRoster() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Update month display
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

        // Create table header with days
        const thead = document.querySelector('#rosterTable thead tr');
        thead.innerHTML = '<th class="employee-col">Employee</th>';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const th = document.createElement('th');
            th.textContent = day;
            th.style.minWidth = '40px';
            thead.appendChild(th);
        }

        // Create employee rows
        const tbody = document.getElementById('rosterBody');
        tbody.innerHTML = '';

        this.employees.forEach(employee => {
            const row = document.createElement('tr');
            
            // Employee name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = employee.name;
            row.appendChild(nameCell);

            // Day cells
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('td');
                cell.className = 'shift-cell empty';
                cell.textContent = '';
                cell.dataset.employeeId = employee.id;
                cell.dataset.date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                cell.addEventListener('click', () => {
                    this.selectedCell = cell;
                    document.getElementById('shiftModal').style.display = 'block';
                });
                
                row.appendChild(cell);
            }

            tbody.appendChild(row);
        });
    }

    async loadShifts() {
        const year = this.currentDate.getFullYear();
        const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
        
        try {
            const response = await fetch(`/api/shifts/${year}/${month}`);
            const shifts = await response.json();
            
            // Clear existing shifts
            document.querySelectorAll('.shift-cell').forEach(cell => {
                cell.className = 'shift-cell empty';
                cell.textContent = '';
            });

            // Apply loaded shifts
            shifts.forEach(shift => {
                const cell = document.querySelector(`[data-employee-id="${shift.employee_id}"][data-date="${shift.date}"]`);
                if (cell) {
                    cell.className = `shift-cell ${shift.shift_type.toLowerCase()}`;
                    cell.textContent = shift.shift_type;
                }
            });
        } catch (error) {
            console.error('Error loading shifts:', error);
        }
    }

    async assignShift(shiftType) {
        if (!this.selectedCell) return;

        const employeeId = this.selectedCell.dataset.employeeId;
        const date = this.selectedCell.dataset.date;

        try {
            const response = await fetch('/api/shifts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employee_id: employeeId,
                    date: date,
                    shift_type: shiftType
                })
            });

            if (response.ok) {
                if (shiftType) {
                    this.selectedCell.className = `shift-cell ${shiftType.toLowerCase()}`;
                    this.selectedCell.textContent = shiftType;
                } else {
                    this.selectedCell.className = 'shift-cell empty';
                    this.selectedCell.textContent = '';
                }
                
                this.updateSummary();
            } else {
                console.error('Error assigning shift');
            }
        } catch (error) {
            console.error('Error assigning shift:', error);
        }
    }

    async updateSummary() {
        const year = this.currentDate.getFullYear();
        const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
        
        try {
            const response = await fetch(`/api/summary/${year}/${month}`);
            const summary = await response.json();
            
            const tbody = document.getElementById('summaryBody');
            tbody.innerHTML = '';

            summary.forEach(employee => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${employee.name}</td>
                    <td>${employee.total_shifts}</td>
                    <td>${employee.s1_count}</td>
                    <td>${employee.s2_count}</td>
                    <td>${employee.s3_count}</td>
                    <td>${employee.s4_count}</td>
                    <td>${employee.s5_count}</td>
                    <td>₹${employee.total_amount.toLocaleString()}</td>
                `;
                
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error updating summary:', error);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ShiftRosterApp();
});