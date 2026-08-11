const fs = require('fs');
const path = require('path');
const pool = require('./db/database');

async function migrateUsers() {

    try {

        const filePath = path.join(__dirname, 'users.json');

        if (!fs.existsSync(filePath)) {
            throw new Error('users.json not found');
        }

        const users = JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        );

        console.log(`Found ${users.length} users in users.json`);

        let imported = 0;
        let skipped = 0;

        for (const user of users) {

            const result = await pool.query(
                `
                INSERT INTO users (
                    id,
                    name,
                    email,
                    password,
                    role,
                    mentor_id,
                    employment_type,
                    department,
                    joining_date,
                    status,
                    archive_reason,
                    archived_on,
                    archived_by
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
                    $13
                )
                ON CONFLICT (email) DO NOTHING
                RETURNING id
                `,
                [
                    user.id,
                    user.name,
                    user.email,
                    user.password,
                    user.role,

                    user.mentorId || null,

                    user.employmentType || null,

                    user.department || null,

                    user.joiningDate || null,

                    user.status || 'Active',

                    user.archiveReason || null,

                    user.archivedOn || null,

                    user.archivedBy || null
                ]
            );

            if (result.rowCount > 0) {
                imported++;
                console.log(`Imported: ${user.email}`);
            } else {
                skipped++;
                console.log(`Skipped: ${user.email}`);
            }
        }

        /*
         * Reset PostgreSQL's SERIAL sequence
         * so future users receive the correct ID.
         */
        await pool.query(`
            SELECT setval(
                pg_get_serial_sequence('users', 'id'),
                COALESCE((SELECT MAX(id) FROM users), 1),
                true
            );
        `);

        console.log('');
        console.log('==============================');
        console.log('USER MIGRATION COMPLETE');
        console.log('==============================');
        console.log(`Imported: ${imported}`);
        console.log(`Skipped:  ${skipped}`);
        console.log(`Total:    ${users.length}`);
        console.log('==============================');

    } catch (error) {

        console.error('');
        console.error('USER MIGRATION FAILED');
        console.error(error);

    } finally {

        await pool.end();

    }
}

migrateUsers();