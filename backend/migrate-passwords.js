const pool = require("./db/database");
const bcrypt = require("bcrypt");

async function migratePasswords() {

    try {

        console.log("Starting password migration...");

        const result = await pool.query(`
            SELECT id, email, password
            FROM users
        `);

        let migrated = 0;
        let skipped = 0;

        for (const user of result.rows) {

            // Already bcrypt hashed
            if (
                typeof user.password === "string" &&
                user.password.startsWith("$2")
            ) {

                console.log(
                    `SKIPPED: ${user.email} - already hashed`
                );

                skipped++;

                continue;
            }

            // Hash existing plaintext password
            const hashedPassword =
                await bcrypt.hash(user.password, 10);

            await pool.query(
                `
                UPDATE users
                SET password = $1
                WHERE id = $2
                `,
                [
                    hashedPassword,
                    user.id
                ]
            );

            console.log(
                `MIGRATED: ${user.email}`
            );

            migrated++;
        }

        console.log("");
        console.log("Password migration completed.");
        console.log(`Migrated: ${migrated}`);
        console.log(`Skipped: ${skipped}`);

    } catch (error) {

        console.error(
            "PASSWORD MIGRATION ERROR:",
            error
        );

    } finally {

        await pool.end();

    }

}

migratePasswords();