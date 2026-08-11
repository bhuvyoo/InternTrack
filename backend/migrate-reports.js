const fs = require('fs');
const path = require('path');
const pool = require('./db/database');

async function migrateReports() {

    try {

        const filePath = path.join(__dirname, 'reports.json');

        if (!fs.existsSync(filePath)) {
            throw new Error('reports.json not found');
        }

        const reports = JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        );

        console.log(`Found ${reports.length} reports in reports.json`);

        let imported = 0;
        let skipped = 0;

        for (const report of reports) {

            const existing = await pool.query(
                'SELECT id FROM reports WHERE id = $1',
                [report.id]
            );

            if (existing.rows.length > 0) {

                skipped++;

                console.log(
                    `Skipped report ID: ${report.id}`
                );

                continue;
            }

            await pool.query(
                `
                INSERT INTO reports (
                    id,
                    employee_id,
                    mentor_id,
                    employee_name,
                    employee_email,
                    department,
                    report_date,
                    task,
                    description,
                    progress,
                    hours_worked,
                    status,
                    manager_remarks,
                    submitted_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14
                )
                `,
                [
                    report.id,
                    report.employeeId || 0,
                    report.mentorId || null,
                    report.employeeName || '',
                    report.employeeEmail || '',
                    report.department || '',
                    report.reportDate,
                    report.task || '',
                    report.description || '',
                    report.progress || '',
                    report.hoursWorked || 0,
                    report.status || 'Pending',
                    report.managerRemarks || '',
                    report.submittedAt || new Date()
                ]
            );

            imported++;

            console.log(
                `Imported report ID: ${report.id}`
            );
        }

        // Reset SERIAL sequence
        await pool.query(`
            SELECT setval(
                pg_get_serial_sequence('reports', 'id'),
                COALESCE((SELECT MAX(id) FROM reports), 1),
                true
            );
        `);

        console.log('');
        console.log('==============================');
        console.log('REPORT MIGRATION COMPLETE');
        console.log('==============================');
        console.log(`Imported: ${imported}`);
        console.log(`Skipped:  ${skipped}`);
        console.log(`Total:    ${reports.length}`);
        console.log('==============================');

    } catch (error) {

        console.error('');
        console.error('REPORT MIGRATION FAILED');
        console.error(error);

    } finally {

        await pool.end();

    }
}

migrateReports();