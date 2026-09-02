//IMPORTS
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require('./db/database');
const fs = require("fs");
const XLSX = require("xlsx");
const multer = require("multer");
const crypto = require("crypto");
const {
    encryptData,
    decryptData
} = require("./security/encryption");
const bcrypt = require("bcrypt");



//CONSTANTS
const app = express();
app.use(cors());
app.use(express.json());
const path = require("path");

// =========================================================
// AES-256-GCM REQUEST DECRYPTION MIDDLEWARE
// =========================================================

function decryptRequest(req, res, next) {

    try {

        console.log("\n========================================");
        console.log("ENCRYPTION MIDDLEWARE TRIGGERED");
        console.log("REQUEST BODY RECEIVED:");
        console.log(req.body);
        console.log("========================================");


        // Check whether request contains encrypted payload
        if (
            req.body &&
            req.body.encryptedData &&
            req.body.iv &&
            req.body.authTag
        ) {

            console.log(
                "Encrypted payload detected"
            );


            // Decrypt incoming payload
            const decryptedData =
                decryptData(req.body);


            console.log(
                "DECRYPTED DATA:"
            );

            console.log(
                decryptedData
            );


            // Replace encrypted request body
            // with original decrypted data

            req.body =
                decryptedData;


            console.log(
                "Request body successfully decrypted"
            );

        } else {

            console.log(
                "Request is not encrypted"
            );

        }


        // Continue to actual API route

        next();


    } catch (error) {

        console.error(
            "\nREQUEST DECRYPTION ERROR:"
        );

        console.error(
            error
        );


        return res.status(400).json({

            message:
                "Invalid or corrupted encrypted request"

        });

    }

}


//JWT
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;


//MIDDLEWARE
const upload = multer({
    dest: "uploads/"
});


//HELPER FUNCTIONS

//2. FORMAT EXCEL TO DATE
function formatExcelDate(dateString) {

    if (!dateString) {

        return "";

    }

    const [month, day, year] = dateString.toString().split("/");

    return `20${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}


function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Access token required"
        });
    }

    
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Invalid authorization format"
        });
    }

    const token = authHeader.split(" ")[1];

    try {

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid or expired token"
        });

    }

}

function authorizeRoles(...allowedRoles) {

    return (req, res, next) => {

        if (!req.user) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        next();
    };

}

// ==========================================
// VALIDATION HELPERS
// ==========================================

function isValidEmail(email) {

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(
        String(email).trim()
    );

}


function isValidRole(role) {

    const allowedRoles = [
        "admin",
        "mentor",
        "employee"
    ];

    return allowedRoles.includes(
        String(role).toLowerCase().trim()
    );

}


function isValidStatus(status) {

    const allowedStatuses = [
        "Active",
        "Inactive",
        "Archived"
    ];

    return allowedStatuses.includes(
        String(status).trim()
    );

}


function isValidPhone(phone) {

    // Empty phone is allowed
    if (!phone) {
        return true;
    }

    const phoneRegex =
        /^[0-9+\-\s()]{7,20}$/;

    return phoneRegex.test(
        String(phone).trim()
    );

}

//ROUTES
//1. HOMEROUTE
app.get("/", (req, res) => {
    res.send("InternTrack Backend Running");
});

// ==========================================
// LOGIN
// ==========================================

app.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                message: "Email and password are required."

            });

        }


        // ==========================================
        // FIND USER
        // ==========================================

        const result = await pool.query(

            `
            SELECT *
            FROM users
            WHERE LOWER(TRIM(email))
                  = LOWER(TRIM($1))
            LIMIT 1
            `,

            [email]

        );


        if (result.rows.length === 0) {

            return res.status(401).json({

                message: "Invalid email or password."

            });

        }


        const user = result.rows[0];


        // ==========================================
        // CHECK PASSWORD
        // ==========================================

        let passwordValid = false;


        /*
         * Check whether the stored password
         * is already a bcrypt hash.
         */

        const isBcryptHash =
            typeof user.password === "string" &&
            user.password.startsWith("$2");


        if (isBcryptHash) {

            // --------------------------------------
            // BCRYPT PASSWORD
            // --------------------------------------

            passwordValid =
                await bcrypt.compare(
                    password,
                    user.password
                );

        }

        else {

            // --------------------------------------
            // LEGACY PLAINTEXT PASSWORD
            // --------------------------------------

            passwordValid =
                password === user.password;

        }


        if (!passwordValid) {

            return res.status(401).json({

                message: "Invalid email or password."

            });

        }


        // ==========================================
        // UPGRADE OLD PASSWORD
        // ==========================================

        /*
         * If the user was still using the old
         * plaintext password, automatically convert
         * it to bcrypt after successful login.
         */

        if (!isBcryptHash) {

            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );


            await pool.query(

                `
                UPDATE users

                SET password = $1

                WHERE id = $2
                `,

                [
                    passwordHash,
                    user.id
                ]

            );

        }


        // ==========================================
        // GENERATE JWT
        // ==========================================

        const token = jwt.sign(

            {
                id: user.id,
                email: user.email,
                role: user.role

            },

            JWT_SECRET,

            {
                expiresIn: "1h"
            }

        );


        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({

            token,

            user: {

                id: user.id,

                name: user.name,

                email: user.email,

                role: user.role,

                department: user.department,

                mentorId: user.mentorId,

                employmentType:
                    user.employmentType,

                joiningDate:
                    user.joiningDate,

                status:
                    user.status

            }

        });


    }

    catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        res.status(500).json({

            message:
                "Unable to login."

        });

    }

});


// ==========================================
// FORGOT PASSWORD
// ==========================================

app.post("/forgot-password", async (req, res) => {

    try {

        const { email } = req.body;

        if (!email) {

            return res.status(400).json({
                message: "Email is required"
            });

        }

        // ==========================================
        // FIND USER
        // ==========================================

        const userResult = await pool.query(

            `
            SELECT id, email
            FROM users
            WHERE LOWER(TRIM(email))
                  = LOWER(TRIM($1))
            LIMIT 1
            `,

            [email]

        );


        /*
         * Always return the same response whether
         * the email exists or not.
         *
         * This prevents revealing which emails
         * have accounts.
         */

        if (userResult.rows.length === 0) {

            return res.json({

                message:
                    "If an account exists for this email, a password reset link has been generated."

            });

        }


        const user = userResult.rows[0];


        // ==========================================
        // GENERATE SECURE RESET TOKEN
        // ==========================================

        const resetToken =
            crypto.randomBytes(32).toString("hex");


        // Store only the hash in PostgreSQL

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");


        // Token valid for 15 minutes

        const expiresAt =
            new Date(Date.now() + 15 * 60 * 1000);


        // ==========================================
        // INVALIDATE OLD TOKENS
        // ==========================================

        await pool.query(

            `
            UPDATE password_reset_tokens

            SET used = TRUE

            WHERE user_id = $1
            AND used = FALSE
            `,

            [user.id]

        );


        // ==========================================
        // SAVE NEW TOKEN
        // ==========================================

        await pool.query(

            `
            INSERT INTO password_reset_tokens
            (
                user_id,
                token_hash,
                expires_at,
                used
            )

            VALUES
            (
                $1,
                $2,
                $3,
                FALSE
            )
            `,

            [
                user.id,
                tokenHash,
                expiresAt
            ]

        );


        // ==========================================
        // DEVELOPMENT RESET LINK
        // ==========================================

        const resetLink =
            `http://localhost:4200/reset-password?token=${resetToken}`;


        console.log(
            "PASSWORD RESET LINK:",
            resetLink
        );


        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({

            message:
                "If an account exists for this email, a password reset link has been generated.",

            /*
             * Development only.
             *
             * Later this link will be sent
             * through email instead.
             */

            resetLink:
                resetLink

        });


    } catch (error) {

        console.error(
            "FORGOT PASSWORD ERROR:",
            error
        );

        res.status(500).json({

            message:
                "Unable to process password reset request."

        });

    }

});


// ==========================================
// RESET PASSWORD
// ==========================================

app.post("/reset-password", async (req, res) => {

    try {

        const {
            token,
            password
        } = req.body;


        // ==========================================
        // VALIDATION
        // ==========================================

        if (!token || !password) {

            return res.status(400).json({

                message:
                    "Reset token and new password are required."

            });

        }


        if (password.length < 6) {

            return res.status(400).json({

                message:
                    "Password must contain at least 6 characters."

            });

        }


        // ==========================================
        // HASH TOKEN
        // ==========================================

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");


        // ==========================================
        // FIND VALID TOKEN
        // ==========================================

        const tokenResult = await pool.query(

            `
            SELECT
                id,
                user_id,
                expires_at,
                used

            FROM password_reset_tokens

            WHERE token_hash = $1

            AND used = FALSE

            AND expires_at > CURRENT_TIMESTAMP

            LIMIT 1
            `,

            [tokenHash]

        );


        if (tokenResult.rows.length === 0) {

            return res.status(400).json({

                message:
                    "Invalid or expired password reset link."

            });

        }


        const resetRecord =
            tokenResult.rows[0];


        // ==========================================
        // HASH NEW PASSWORD
        // ==========================================

        const bcrypt =
            require("bcrypt");

        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );


        // ==========================================
        // UPDATE PASSWORD
        // ==========================================

        await pool.query(

            `
            UPDATE users

            SET password = $1

            WHERE id = $2
            `,

            [
                passwordHash,
                resetRecord.user_id
            ]

        );


        // ==========================================
        // INVALIDATE TOKEN
        // ==========================================

        await pool.query(

            `
            UPDATE password_reset_tokens

            SET used = TRUE

            WHERE id = $1
            `,

            [resetRecord.id]

        );


        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({

            message:
                "Password reset successfully."

        });


    } catch (error) {

        console.error(
            "RESET PASSWORD ERROR:",
            error
        );

        res.status(500).json({

            message:
                "Unable to reset password."

        });

    }

});


//3. CREATE REPORT - PostgreSQL

app.post("/reports", authenticateToken, decryptRequest, async (req, res) => {

    try {

        const report = req.body;

// =========================================
// REPORT VALIDATION
// =========================================

// Required employee email
if (
    !report.employeeEmail ||
    !report.employeeEmail.toString().trim()
) {

    return res.status(400).json({
        message: "Employee email is required."
    });

}


// Validate employee email
if (!isValidEmail(report.employeeEmail)) {

    return res.status(400).json({
        message: "Please provide a valid employee email."
    });

}


// Required report date
if (!report.reportDate) {

    return res.status(400).json({
        message: "Report date is required."
    });

}


// Validate report date
const reportDate = new Date(report.reportDate);

if (isNaN(reportDate.getTime())) {

    return res.status(400).json({
        message: "Please provide a valid report date."
    });

}


// Required task
if (
    !report.task ||
    !report.task.toString().trim()
) {

    return res.status(400).json({
        message: "Task is required."
    });

}


// Required description
if (
    !report.description ||
    !report.description.toString().trim()
) {

    return res.status(400).json({
        message: "Report description is required."
    });

}


// Hours validation
const hoursWorked = Number(report.hoursWorked);

if (
    !Number.isFinite(hoursWorked) ||
    hoursWorked <= 0 ||
    hoursWorked > 24
) {

    return res.status(400).json({
        message:
            "Hours worked must be greater than 0 and cannot exceed 24 hours."
    });

}


// Progress validation
if (
    report.progress &&
    report.progress.toString().trim().length > 100
) {

    return res.status(400).json({
        message:
            "Progress must not exceed 100 characters."
    });

}


console.log("POST REPORT - PostgreSQL");
console.log("Incoming Report:", report);


// =========================================
// FIND AUTHENTICATED EMPLOYEE FROM JWT
// =========================================

const employeeResult = await pool.query(

    `
    SELECT
        id,
        name,
        email,
        department,
        mentor_id,
        role
    FROM users
    WHERE id = $1
    LIMIT 1
    `,

    [req.user.id]

);


if (employeeResult.rows.length === 0) {

    return res.status(401).json({

        message: "Authenticated user not found."

    });

}


const employee = employeeResult.rows[0];


// =========================================
// REPORT OWNERSHIP SECURITY
// =========================================

if (employee.role !== "employee") {

    return res.status(403).json({

        message: "Only employees can submit reports."

    });

}


        // =========================================
        // DUPLICATE CHECK
        // Same employee + same report date
        // =========================================

        const duplicateResult = await pool.query(

            `
            SELECT id
            FROM reports
            WHERE employee_id = $1
              AND report_date = $2
            LIMIT 1
            `,

            [
                employee.id,
                report.reportDate
            ]

        );


        if (duplicateResult.rows.length > 0) {

            console.log("DUPLICATE REPORT FOUND");

            return res.status(400).json({

                message:
                    "Report already exists for this employee on this date."

            });

        }


        // =========================================
        // INSERT REPORT
        // =========================================

        const result = await pool.query(

            `
            INSERT INTO reports (

                employee_id,
                mentor_id,
                report_date,
                task,
                department,
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
                COALESCE($11::timestamp, CURRENT_TIMESTAMP)

            )

            RETURNING *

            `,

            [

                employee.id,

                employee.mentor_id || null,

                report.reportDate,

                report.task || "",

                report.department ||
                    employee.department ||
                    "",

                report.description || "",

                report.progress || "",

                Number(report.hoursWorked) || 0,

                report.status || "Pending",

                report.managerRemarks || "",

                report.submittedAt || null

            ]

        );


        const savedReport = result.rows[0];


        // =========================================
        // CONVERT DB RESPONSE TO ANGULAR FORMAT
        // =========================================

        const newReport = {

            id:
                savedReport.id,

            employeeId:
                savedReport.employee_id,

            employeeName:
                employee.name,

            employeeEmail:
                employee.email,

            mentorId:
                savedReport.mentor_id,

            department:
                savedReport.department || "",

            reportDate:
                savedReport.report_date,

            task:
                savedReport.task || "",

            description:
                savedReport.description || "",

            progress:
                savedReport.progress || "",

            hoursWorked:
                Number(savedReport.hours_worked) || 0,

            status:
                savedReport.status || "Pending",

            managerRemarks:
                savedReport.manager_remarks || "",

            submittedAt:
                savedReport.submitted_at

        };


        console.log(
            "New Report Saved To PostgreSQL:",
            newReport
        );


        // =========================================
        // RESPONSE
        // =========================================

        res.status(201).json({

            message:
                "Report Saved Successfully",

            report:
                newReport

        });


    } catch (error) {

        console.error(
            "CREATE REPORT DATABASE ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Unable to save report.",

            error:
                error.message

        });

    }

});

//4. UPDATE REPORT - PostgreSQL

app.put("/reports/:id", authenticateToken, async (req, res) => {

    try {

        const id = parseInt(req.params.id);

        if (isNaN(id)) {

            return res.status(400).json({

                message: "Invalid report ID"

            });

        }


        const updatedReport = req.body;


        // =========================================
        // CHECK REPORT EXISTS
        // =========================================

        const existingResult = await pool.query(

            `
            SELECT *
            FROM reports
            WHERE id = $1
            `,

            [id]

        );


        if (existingResult.rows.length === 0) {

            return res.status(404).json({

                message: "Report not found"

            });

        }


        const existingReport =
            existingResult.rows[0];


        // =========================================
        // REPORT OWNERSHIP / AUTHORIZATION
        // =========================================

        if (

            req.user.role === "employee" &&

            Number(existingReport.employee_id)
            !== Number(req.user.id)

        ) {

            return res.status(403).json({

                message:
                    "You are not allowed to update another employee's report."

            });

        }


        if (

            req.user.role === "mentor" &&

            Number(existingReport.mentor_id)
            !== Number(req.user.id)

        ) {

            return res.status(403).json({

                message:
                    "You are not allowed to update a report not assigned to you."

            });

        }


        // =========================================
        // EMPLOYEE UPDATE RULES
        // Employees cannot change approval fields
        // =========================================

        let status =
            existingReport.status;

        let managerRemarks =
            existingReport.manager_remarks;


        if (

            req.user.role === "mentor" ||

            req.user.role === "admin"

        ) {

            status =
                updatedReport.status ||
                existingReport.status;

            managerRemarks =
                updatedReport.managerRemarks || "";

        }


        // =========================================
        // UPDATE REPORT
        // =========================================

        const result = await pool.query(

            `
            UPDATE reports

            SET

                report_date = $1,
                task = $2,
                department = $3,
                description = $4,
                progress = $5,
                hours_worked = $6,
                status = $7,
                manager_remarks = $8

            WHERE id = $9

            RETURNING *

            `,

            [

                updatedReport.reportDate ||
                    existingReport.report_date,

                updatedReport.task ??
                    existingReport.task,

                updatedReport.department ??
                    existingReport.department,

                updatedReport.description ??
                    existingReport.description,

                updatedReport.progress ??
                    existingReport.progress,

                updatedReport.hoursWorked !== undefined
                    ? Number(updatedReport.hoursWorked)
                    : Number(existingReport.hours_worked),

                status,

                managerRemarks,

                id

            ]

        );


        const savedReport =
            result.rows[0];


        // =========================================
        // GET EMPLOYEE DETAILS
        // =========================================

        const employeeResult = await pool.query(

            `
            SELECT
                name,
                email
            FROM users
            WHERE id = $1
            `,

            [savedReport.employee_id]

        );


        const employee =
            employeeResult.rows[0] || {};


        // =========================================
        // FORMAT RESPONSE
        // =========================================

        const formattedReport = {

            id:
                savedReport.id,

            employeeId:
                savedReport.employee_id,

            employeeName:
                employee.name || "",

            employeeEmail:
                employee.email || "",

            mentorId:
                savedReport.mentor_id || null,

            department:
                savedReport.department || "",

            reportDate:
                savedReport.report_date || "",

            task:
                savedReport.task || "",

            description:
                savedReport.description || "",

            progress:
                savedReport.progress || "",

            hoursWorked:
                Number(savedReport.hours_worked) || 0,

            status:
                savedReport.status || "Pending",

            managerRemarks:
                savedReport.manager_remarks || "",

            submittedAt:
                savedReport.submitted_at || ""

        };


        console.log(
            "Updated Report in PostgreSQL:",
            formattedReport
        );


        res.json({

            message:
                "Report Updated Successfully",

            report:
                formattedReport

        });


    } catch (error) {

        console.error(
            "UPDATE REPORT DATABASE ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Error updating report",

            error:
                error.message

        });

    }

});

//5. DELETE REPORT - PostgreSQL

app.delete("/reports/:id", authenticateToken, async (req, res) => {

    try {

        const id = parseInt(req.params.id);

        if (isNaN(id)) {

            return res.status(400).json({
                message: "Invalid report ID"
            });

        }


        // =========================================
        // FIND REPORT
        // =========================================

        const existingResult = await pool.query(

            `
            SELECT
                id,
                employee_id
            FROM reports
            WHERE id = $1
            `,

            [id]

        );


        if (existingResult.rows.length === 0) {

            return res.status(404).json({

                message: "Report not found"

            });

        }


        const report = existingResult.rows[0];


        // =========================================
        // AUTHORIZATION
        // ADMIN → Can delete any report
        // EMPLOYEE → Can delete only own report
        // =========================================

        if (req.user.role === "employee") {

            if (report.employee_id !== req.user.id) {

                return res.status(403).json({

                    message:
                        "You can only delete your own reports."

                });

            }

        }

        else if (req.user.role !== "admin") {

            return res.status(403).json({

                message:
                    "You are not authorized to delete reports."

            });

        }


        // =========================================
        // DELETE REPORT
        // =========================================

        await pool.query(

            `
            DELETE FROM reports
            WHERE id = $1
            `,

            [id]

        );


        console.log(
            `Report ${id} deleted by ${req.user.email}`
        );


        res.json({

            message:
                "Report deleted successfully"

        });


    } catch (error) {

        console.error(
            "DELETE REPORT DATABASE ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Error deleting report",

            error:
                error.message

        });

    }

});

// =========================================
// 6. VIEW REPORTS - PostgreSQL
// ROLE + OWNERSHIP BASED ACCESS
// =========================================

app.get("/reports", authenticateToken, async (req, res) => {

    try {

        let query;
        let queryParams = [];


        // =========================================
        // ADMIN
        // Can view all reports
        // =========================================

        if (req.user.role === "admin") {

            query = `

                SELECT
                    r.id,
                    r.employee_id,
                    u.name AS employee_name,
                    u.email AS employee_email,
                    r.mentor_id,
                    r.department,
                    r.report_date,
                    r.task,
                    r.description,
                    r.progress,
                    r.hours_worked,
                    r.status,
                    r.manager_remarks,
                    r.submitted_at

                FROM reports r

                LEFT JOIN users u
                    ON r.employee_id = u.id

                ORDER BY r.report_date DESC, r.id DESC

            `;

        }


        // =========================================
        // EMPLOYEE
        // Can view only their own reports
        // =========================================

        else if (req.user.role === "employee") {

            query = `

                SELECT
                    r.id,
                    r.employee_id,
                    u.name AS employee_name,
                    u.email AS employee_email,
                    r.mentor_id,
                    r.department,
                    r.report_date,
                    r.task,
                    r.description,
                    r.progress,
                    r.hours_worked,
                    r.status,
                    r.manager_remarks,
                    r.submitted_at

                FROM reports r

                LEFT JOIN users u
                    ON r.employee_id = u.id

                WHERE r.employee_id = $1

                ORDER BY r.report_date DESC, r.id DESC

            `;

            queryParams = [req.user.id];

        }


        // =========================================
        // MENTOR
        // Can view only reports assigned to them
        // =========================================

        else if (req.user.role === "mentor") {

            query = `

                SELECT
                    r.id,
                    r.employee_id,
                    u.name AS employee_name,
                    u.email AS employee_email,
                    r.mentor_id,
                    r.department,
                    r.report_date,
                    r.task,
                    r.description,
                    r.progress,
                    r.hours_worked,
                    r.status,
                    r.manager_remarks,
                    r.submitted_at

                FROM reports r

                LEFT JOIN users u
                    ON r.employee_id = u.id

                WHERE r.mentor_id = $1

                ORDER BY r.report_date DESC, r.id DESC

            `;

            queryParams = [req.user.id];

        }


        // =========================================
        // UNKNOWN ROLE
        // =========================================

        else {

            return res.status(403).json({

                message:
                    "You are not authorized to view reports."

            });

        }


        // =========================================
        // EXECUTE QUERY
        // =========================================

        const result = await pool.query(
            query,
            queryParams
        );


        // =========================================
        // CONVERT POSTGRESQL FORMAT
        // TO ANGULAR FORMAT
        // =========================================

        const reports = result.rows.map(report => ({

            id:
                report.id,

            employeeId:
                report.employee_id,

            employeeName:
                report.employee_name || "",

            employeeEmail:
                report.employee_email || "",

            mentorId:
                report.mentor_id || null,

            department:
                report.department || "",

            reportDate:
                report.report_date || "",

            task:
                report.task || "",

            description:
                report.description || "",

            progress:
                report.progress || "",

            hoursWorked:
                Number(report.hours_worked) || 0,

            status:
                report.status || "Pending",

            managerRemarks:
                report.manager_remarks || "",

            submittedAt:
                report.submitted_at || ""

        }));


        console.log(
            `Reports fetched for ${req.user.role}:`,
            reports.length
        );


        res.json(reports);


    } catch (error) {

        console.error(
            "GET REPORTS DATABASE ERROR:",
            error
        );


        res.status(500).json({

            message:
                "Error fetching reports from database"

        });

    }

});

//7. EXPORT EXCEL - PostgreSQL + SEARCH + DATE FILTER

app.get("/export", authenticateToken, async (req, res) => {

    try {

        // ==========================================
        // GET FILTER VALUES
        // ==========================================

        const search =
            (req.query.search || "")
                .toString()
                .trim();

        const fromDate =
            (req.query.fromDate || "")
                .toString()
                .trim();

        const toDate =
            (req.query.toDate || "")
                .toString()
                .trim();


        // ==========================================
        // BUILD POSTGRESQL QUERY
        // ==========================================

        let query = `
            SELECT
                r.id,
                u.name AS employee_name,
                u.email AS employee_email,
                r.report_date,
                r.task,
                r.department,
                r.progress,
                r.hours_worked,
                r.status
            FROM reports r
            LEFT JOIN users u
                ON r.employee_id = u.id
            WHERE 1 = 1
        `;

        const values = [];
        let parameterIndex = 1;


        // ==========================================
        // SEARCH FILTER
        // ==========================================

        if (search) {

            query += `
                AND (
                    LOWER(COALESCE(u.name, '')) LIKE LOWER($${parameterIndex})
                    OR LOWER(COALESCE(u.email, '')) LIKE LOWER($${parameterIndex})
                    OR LOWER(COALESCE(r.task, '')) LIKE LOWER($${parameterIndex})
                    OR LOWER(COALESCE(r.department, '')) LIKE LOWER($${parameterIndex})
                    OR LOWER(COALESCE(r.status, '')) LIKE LOWER($${parameterIndex})
                )
            `;

            values.push(`%${search}%`);

            parameterIndex++;

        }


        // ==========================================
        // FROM DATE FILTER
        // ==========================================

        if (fromDate) {

            query += `
                AND r.report_date >= $${parameterIndex}
            `;

            values.push(fromDate);

            parameterIndex++;

        }


        // ==========================================
        // TO DATE FILTER
        // ==========================================

        if (toDate) {

            query += `
                AND r.report_date <= $${parameterIndex}
            `;

            values.push(toDate);

            parameterIndex++;

        }


        // ==========================================
        // SORT
        // ==========================================

        query += `
            ORDER BY r.report_date ASC, r.id ASC
        `;


        // ==========================================
        // GET DATA FROM POSTGRESQL
        // ==========================================

        const result = await pool.query(
            query,
            values
        );


        // ==========================================
        // CONVERT DATABASE DATA TO EXCEL DATA
        // ==========================================

        const exportData = result.rows.map(report => ({

            "Employee Name":
                report.employee_name || "",

            "Employee Email":
                report.employee_email || "",

            "Report Date":
                report.report_date || "",

            "Task":
                report.task || "",

            "Department":
                report.department || "",

            "Progress":
                report.progress || "",

            "Hours Worked":
                report.hours_worked || 0,

            "Status":
                report.status || "Pending"

        }));


        // ==========================================
        // CREATE EXCEL WORKSHEET
        // ==========================================

        const worksheet =
            XLSX.utils.json_to_sheet(exportData);


        // ==========================================
        // CREATE EXCEL WORKBOOK
        // ==========================================

        const workbook =
            XLSX.utils.book_new();


        XLSX.utils.book_append_sheet(

            workbook,

            worksheet,

            "Reports"

        );


        // ==========================================
        // FILE PATH
        // ==========================================

        const exportPath = path.join(

            __dirname,

            "InternTrack_Report.xlsx"

        );


        // ==========================================
        // WRITE EXCEL FILE
        // ==========================================

        XLSX.writeFile(

            workbook,

            exportPath

        );


        // ==========================================
        // DOWNLOAD FILE
        // ==========================================

        res.download(exportPath);


    } catch (error) {

        console.error(

            "EXPORT REPORT DATABASE ERROR:",

            error

        );


        res.status(500).json({

            message:
                "Error exporting reports from PostgreSQL"

        });

    }

});

//8. IMPORT EXCEL - PostgreSQL

app.post(
    "/import",
    authenticateToken,
    authorizeRoles("admin"),
    upload.single("file"),
    async (req, res) => {

        try {

            // ==========================================
            // CHECK FILE
            // ==========================================

            if (!req.file) {

                return res.status(400).json({

                    message: "No file uploaded"

                });

            }


            // ==========================================
            // READ EXCEL
            // ==========================================

            const workbook = XLSX.readFile(
                req.file.path,
                {
                    cellDates: true
                }
            );


            const sheetName =
                workbook.SheetNames[0];

            const worksheet =
                workbook.Sheets[sheetName];


            const importedReports =
                XLSX.utils.sheet_to_json(

                    worksheet,

                    {
                        raw: false,
                        defval: ""
                    }

                );


            if (importedReports.length === 0) {

                return res.status(400).json({

                    message: "Excel file is empty"

                });

            }


            // ==========================================
            // NORMALIZE EXCEL DATA
            // ==========================================

            const normalizedReports =
                importedReports.map(report => ({

                    employeeName:
                        report["Employee Name"]
                            ?.toString()
                            .trim() || "",

                    employeeEmail:
                        report["Employee Email"]
                            ?.toString()
                            .trim() || "",

                    department:
                        report["Department"]
                            ?.toString()
                            .trim() || "",

                    reportDate:
                        formatExcelDate(
                            report["Report Date"]
                        ),

                    task:
                        report["Task"]
                            ?.toString()
                            .trim() || "",

                    description:
                        report["Description"]
                            ?.toString()
                            .trim() || "",

                    progress:
                        report["Progress"]
                            ?.toString()
                            .trim() || "",

                    hoursWorked:
                        Number(
                            report["Hours Worked"]
                        ) || 0,

                    status:
                        report["Status"]
                            ?.toString()
                            .trim() || "Pending",

                    managerRemarks:
                        report["Manager Remarks"]
                            ?.toString()
                            .trim() || "",

                    submittedAt:
                        new Date().toISOString()

                }));


            console.log(
                "Normalized Reports:",
                normalizedReports
            );


            // ==========================================
            // REMOVE INVALID / EMPTY ROWS
            // ==========================================

            const validReports =
                normalizedReports.filter(report =>

                    report.employeeName &&
                    report.employeeEmail &&
                    report.reportDate &&
                    report.task &&
                    report.description &&
                    report.progress &&
                    report.hoursWorked >= 0 &&
                    report.status

                );


            // ==========================================
            // REMOVE DUPLICATES INSIDE EXCEL
            // ==========================================

            const seenKeys = new Set();

            const uniqueReports =
                validReports.filter(report => {

                    const key = [

                        report.employeeEmail
                            .trim()
                            .toLowerCase(),

                        report.reportDate,

                        report.task
                            .trim()
                            .toLowerCase()

                    ].join("_");


                    if (seenKeys.has(key)) {

                        return false;

                    }


                    seenKeys.add(key);

                    return true;

                });


            const excelDuplicates =
                validReports.length -
                uniqueReports.length;


            console.log(
                "Unique Excel Reports:",
                uniqueReports.length
            );


            // ==========================================
            // INSERT INTO POSTGRESQL
            // ==========================================

            let importedCount = 0;

            let skippedCount = 0;

            let missingEmployees = 0;

            let databaseDuplicates = 0;


            for (const report of uniqueReports) {


                // ======================================
                // FIND EMPLOYEE IN POSTGRESQL
                // ======================================

                const employeeResult =
                    await pool.query(

                        `
                        SELECT
                            id,
                            name,
                            email,
                            department
                        FROM users
                        WHERE LOWER(TRIM(email))
                              = LOWER(TRIM($1))
                        LIMIT 1
                        `,

                        [
                            report.employeeEmail
                        ]

                    );


                // Employee doesn't exist

                if (
                    employeeResult.rows.length === 0
                ) {

                    missingEmployees++;

                    continue;

                }


                const employee =
                    employeeResult.rows[0];


                // ======================================
                // CHECK DATABASE DUPLICATE
                // ======================================

                const duplicateResult =
                    await pool.query(

                        `
                        SELECT id
                        FROM reports

                        WHERE employee_id = $1

                        AND report_date = $2

                        AND LOWER(TRIM(task))
                            = LOWER(TRIM($3))

                        LIMIT 1
                        `,

                        [

                            employee.id,

                            report.reportDate,

                            report.task

                        ]

                    );


                if (
                    duplicateResult.rows.length > 0
                ) {

                    databaseDuplicates++;

                    continue;

                }


                // ======================================
                // INSERT REPORT
                // ======================================

                await pool.query(

                    `
                    INSERT INTO reports (

                        employee_id,
                        mentor_id,
                        report_date,
                        task,
                        department,
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
                        $11

                    )
                    `,

                    [

                        employee.id,

                        null,

                        report.reportDate,

                        report.task,

                        report.department ||
                            employee.department ||
                            "",

                        report.description,

                        report.progress,

                        report.hoursWorked,

                        report.status,

                        report.managerRemarks,

                        report.submittedAt

                    ]

                );


                importedCount++;

            }


            // ==========================================
            // DELETE TEMPORARY EXCEL FILE
            // ==========================================

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }


            // ==========================================
            // GET TOTAL REPORT COUNT
            // ==========================================

            const countResult =
                await pool.query(

                    `
                    SELECT COUNT(*) AS total
                    FROM reports
                    `

                );


            const totalReports =
                Number(
                    countResult.rows[0].total
                );


            // ==========================================
            // RESPONSE
            // ==========================================

            res.json({

                success: true,

                message:
                    "Import Successful",

                summary: {

                    totalRows:
                        importedReports.length,

                    validRows:
                        validReports.length,

                    missingEmployees:
                        missingEmployees,

                    excelDuplicates:
                        excelDuplicates,

                    databaseDuplicates:
                        databaseDuplicates,

                    imported:
                        importedCount,

                    totalReports:
                        totalReports

                }

            });


        } catch (error) {

            console.error(
                "IMPORT REPORTS DATABASE ERROR:",
                error
            );


            // Remove temporary file
            // if something fails

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }


            res.status(500).json({

                message:
                    "Import Failed",

                error:
                    error.message

            });

        }

    }
);


// ==========================================
// GET CURRENT LOGGED-IN USER
// ==========================================

app.get(
    "/users/me",
    authenticateToken,
    async (req, res) => {

        try {

            const userId = req.user.id;

            const result = await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    role,
                    employment_type,
                    department,
                    joining_date,
                    status,
                    mentor_id
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [userId]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    message: "User not found"
                });

            }

            const user = result.rows[0];

            res.json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                employmentType: user.employment_type || "",
                department: user.department || "",
                joiningDate: user.joining_date || "",
                status: user.status || "",
                mentorId: user.mentor_id || null
            });

        } catch (error) {

            console.error("GET CURRENT USER ERROR:", error);

            res.status(500).json({
                message: "Unable to fetch user profile"
            });

        }

    }
);


// ==========================================
// GET CURRENT LOGGED-IN USER
// ==========================================

app.get("/current-user", authenticateToken, async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                role,
                employment_type,
                department,
                joining_date,
                status,
                mentor_id,
                phone
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [req.user.id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        const user = result.rows[0];

        res.json({

            id: user.id,

            name: user.name,

            email: user.email,

            role: user.role,

            employmentType:
                user.employment_type || "",

            department:
                user.department || "",

            joiningDate:
                user.joining_date || "",

            status:
                user.status || "Active",

            mentorId:
                user.mentor_id || null,

            phone:
                user.phone || ""

        });

    } catch (error) {

        console.error(
            "GET CURRENT USER ERROR:",
            error
        );

        res.status(500).json({
            message: "Unable to fetch user profile"
        });

    }

});


// ==========================================
// GET ASSIGNED MENTOR
// ==========================================

app.get("/my-mentor", authenticateToken, async (req, res) => {

    try {

        // Get mentor ID of logged-in user
        const userResult = await pool.query(
            `
            SELECT mentor_id
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [req.user.id]
        );

        if (userResult.rows.length === 0) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        const mentorId =
            userResult.rows[0].mentor_id;


        // No mentor assigned
        if (!mentorId) {

            return res.json({
                assigned: false,
                mentor: null
            });

        }


        // Get ONLY assigned mentor details
        const mentorResult = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                department,
                role
            FROM users
            WHERE id = $1
            AND role = 'mentor'
            LIMIT 1
            `,
            [mentorId]
        );


        if (mentorResult.rows.length === 0) {

            return res.json({
                assigned: false,
                mentor: null
            });

        }


        const mentor =
            mentorResult.rows[0];


        res.json({

            assigned: true,

            mentor: {

                id: mentor.id,

                name: mentor.name,

                email: mentor.email,

                department:
                    mentor.department || "",

                role:
                    mentor.role

            }

        });

    } catch (error) {

        console.error(
            "GET MY MENTOR ERROR:",
            error
        );

        res.status(500).json({
            message: "Unable to fetch mentor information"
        });

    }

});


// ==========================================
// UPDATE CURRENT USER PROFILE
// ==========================================

app.put("/current-user", authenticateToken, async (req, res) => {

    try {
        const {name, phone} = req.body;

// ==========================================
// VALIDATION
// ==========================================

// Name required
if (!name || !name.toString().trim()) {

    return res.status(400).json({
        message: "Name is required."
    });

}

// Name length validation
if (name.toString().trim().length < 2) {

    return res.status(400).json({
        message: "Name must contain at least 2 characters."
    });

}

// Phone validation
if (!isValidPhone(phone)) {

    return res.status(400).json({
        message: "Please enter a valid phone number."
    });

}

        const result = await pool.query(`UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING 
            id, name, email, role, employment_type, department, joining_date, status, mentor_id, phone`,
            [
                name.trim(),

                phone ? phone.trim() : "",

                req.user.id
            ]

        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                message:
                    "User not found"

            });

        }


        const user =
            result.rows[0];


        res.json({

            message:
                "Profile updated successfully",

            user: {

                id: user.id,

                name: user.name,

                email: user.email,

                role: user.role,

                employmentType:
                    user.employment_type || "",

                department:
                    user.department || "",

                joiningDate:
                    user.joining_date || "",

                status:
                    user.status || "Active",

                mentorId:
                    user.mentor_id || null,

                phone:
                    user.phone || ""

            }

        });

    } catch (error) {

        console.error(
            "UPDATE CURRENT USER ERROR:",
            error
        );

        res.status(500).json({

            message:
                "Unable to update profile"

        });

    }

});


// 9. GET USERS - PostgreSQL
app.get("/users", authenticateToken, authorizeRoles("admin"), async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                id,
                name,
                email,
                role,
                employment_type,
                department,
                joining_date,
                status,
                mentor_id,
                archive_reason,
                archived_on,
                archived_by
            FROM users
            ORDER BY id;
        `);

        const users = result.rows.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            employmentType: user.employment_type || "",
            department: user.department || "",
            joiningDate: user.joining_date || "",
            status: user.status || "Active",
            mentorId: user.mentor_id || null,
            archiveReason: user.archive_reason || "",
            archivedOn: user.archived_on || "",
            archivedBy: user.archived_by || ""
        }));

        res.json(users);

    } catch (error) {

        console.error("GET USERS DATABASE ERROR:", error);

        res.status(500).json({
            message: "Error fetching employees from database"
        });

    }

});


//10. EXPORT EMPLOYEES - PostgreSQL

app.get("/export-users", async (req, res) => {

    try {

        // Get employees directly from PostgreSQL

        const result = await pool.query(`

            SELECT
                name,
                email,
                role,
                employment_type,
                department,
                joining_date,
                status

            FROM users

            ORDER BY id

        `);


        // Convert database fields to Excel columns

        const exportData = result.rows.map(user => ({

            Name:
                user.name || "",

            Email:
                user.email || "",

            Role:
                user.role || "",

            "Employment Type":
                user.employment_type || "",

            Department:
                user.department || "",

            "Joining Date":
                user.joining_date || "",

            Status:
                user.status || "Active"

        }));


        // Create Excel worksheet

        const worksheet =
            XLSX.utils.json_to_sheet(exportData);


        // Create Excel workbook

        const workbook =
            XLSX.utils.book_new();


        XLSX.utils.book_append_sheet(

            workbook,

            worksheet,

            "Employees"

        );


        // File path

        const filePath = path.join(

            __dirname,

            "InternTrack_Employees.xlsx"

        );


        // Generate Excel file

        XLSX.writeFile(

            workbook,

            filePath

        );


        // Send file to frontend

        res.download(filePath);


    } catch (error) {

        console.error(

            "EXPORT EMPLOYEES DATABASE ERROR:",

            error

        );


        res.status(500).json({

            message:
                "Unable to export employees."

        });

    }

});


//11. IMPORT EMPLOYEES - PostgreSQL

app.post(
    "/import-users",
    upload.single("file"),
    async (req, res) => {

        try {

            // ==========================================
            // CHECK FILE
            // ==========================================

            if (!req.file) {

                return res.status(400).json({

                    message: "No file uploaded"

                });

            }


            // ==========================================
            // READ EXCEL FILE
            // ==========================================

            const workbook = XLSX.readFile(
                req.file.path
            );

            const sheetName =
                workbook.SheetNames[0];

            const worksheet =
                workbook.Sheets[sheetName];

            const importedUsers =
                XLSX.utils.sheet_to_json(
                    worksheet,
                    {
                        defval: ""
                    }
                );


            // ==========================================
            // CHECK EMPTY FILE
            // ==========================================

            if (importedUsers.length === 0) {

                return res.status(400).json({

                    message: "Excel file is empty"

                });

            }


            // ==========================================
            // REMOVE EMPTY ROWS
            // ==========================================

            const validUsers =
                importedUsers.filter(user =>

                    user.Name &&
                    user.Email &&
                    user.Role

                );


            // ==========================================
            // REMOVE DUPLICATES INSIDE EXCEL
            // ==========================================

            const seenEmails = new Set();

            const uniqueUsers =
                validUsers.filter(user => {

                    const email =
                        user.Email
                            .toString()
                            .trim()
                            .toLowerCase();


                    if (seenEmails.has(email)) {

                        return false;

                    }


                    seenEmails.add(email);

                    return true;

                });


            // ==========================================
            // INSERT NEW USERS INTO POSTGRESQL
            // ==========================================

            let importedCount = 0;

            let skippedCount = 0;


            for (const user of uniqueUsers) {

                const name =
                    user.Name
                        .toString()
                        .trim();

                const email =
                    user.Email
                        .toString()
                        .trim();

                const role =
                    user.Role
                        .toString()
                        .trim()
                        .toLowerCase();


                // --------------------------------------
                // CHECK EMAIL IN POSTGRESQL
                // --------------------------------------

                const existing =
                    await pool.query(

                        `
                        SELECT id
                        FROM users
                        WHERE LOWER(TRIM(email))
                              = LOWER(TRIM($1))
                        LIMIT 1
                        `,

                        [email]

                    );


                if (existing.rows.length > 0) {

                    skippedCount++;

                    continue;

                }

                // --------------------------------------
// HASH DEFAULT PASSWORD
// --------------------------------------

const defaultPassword = "123456";

const hashedPassword =
    await bcrypt.hash(
        defaultPassword,
        10
    );


                // --------------------------------------
                // INSERT INTO POSTGRESQL
                // --------------------------------------

                await pool.query(

                    `
                    INSERT INTO users
                    (
                        name,
                        email,
                        password,
                        role,
                        employment_type,
                        department,
                        joining_date,
                        status
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        'Active'
                    )
                    `,

                    [
    name,

    email,

    hashedPassword,

    role,

    user["Employment Type"] ||
    user.employmentType ||
    null,

    user.Department ||
    user.department ||
    null,

    user["Joining Date"] ||
    user.joiningDate ||
    null
]

                );


                importedCount++;

            }


            // ==========================================
            // DELETE TEMPORARY EXCEL FILE
            // ==========================================

            if (req.file) {

                fs.unlinkSync(
                    req.file.path
                );

            }


            // ==========================================
            // RESPONSE
            // ==========================================

            res.json({

                success: true,

                message:
                    "Employee import completed",

                imported:
                    importedCount,

                skipped:
                    skippedCount

            });


        }

        catch (error) {

            console.error(
                "IMPORT USERS DATABASE ERROR:",
                error
            );


            // Delete temporary file

            if (
                req.file &&
                fs.existsSync(req.file.path)
            ) {

                fs.unlinkSync(
                    req.file.path
                );

            }


            res.status(500).json({

                message:
                    "Employee import failed",

                error:
                    error.message

            });

        }

    }

);


//12. ADD USER - PostgreSQL

app.post( "/users", authenticateToken, authorizeRoles("admin"), async (req, res) => {

        try {

            const {
                name,
                email,
                password,
                role,
                employmentType,
                department,
                joiningDate,
                status,
                mentorId
            } = req.body;

            // ==========================================
// VALIDATION
// ==========================================

// Required fields
if (
    !name ||
    !name.toString().trim() ||
    !email ||
    !email.toString().trim() ||
    !password ||
    !role ||
    !role.toString().trim()
) {

    return res.status(400).json({
        message: "Name, email, password and role are required."
    });

}


// Name validation
if (name.toString().trim().length < 2) {

    return res.status(400).json({
        message: "Name must contain at least 2 characters."
    });

}


// Email validation
if (!isValidEmail(email)) {

    return res.status(400).json({
        message: "Please enter a valid email address."
    });

}


// Password validation
if (password.toString().length < 6) {

    return res.status(400).json({
        message: "Password must contain at least 6 characters."
    });

}


// Role validation
if (!isValidRole(role)) {

    return res.status(400).json({
        message: "Role must be admin, mentor or employee."
    });

}


// Status validation
if (status && !isValidStatus(status)) {

    return res.status(400).json({
        message: "Invalid user status."
    });

}


            // ==========================================
            // CHECK DUPLICATE EMAIL
            // ==========================================

            const existingUser =
                await pool.query(

                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(TRIM(email))
                          = LOWER(TRIM($1))
                    LIMIT 1
                    `,

                    [email]

                );


            if (existingUser.rows.length > 0) {

                return res.status(400).json({

                    message:
                        "Email already exists."

                });

            }


            // ==========================================
            // HASH PASSWORD
            // ==========================================

            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );


            // ==========================================
            // INSERT USER
            // ==========================================

            const result =
                await pool.query(

                    `
                    INSERT INTO users
                    (
                        name,
                        email,
                        password,
                        role,
                        employment_type,
                        department,
                        joining_date,
                        status,
                        mentor_id
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9
                    )

                    RETURNING
                        id,
                        name,
                        email,
                        role,
                        employment_type,
                        department,
                        joining_date,
                        status,
                        mentor_id
                    `,

                    [

                        name
                            .toString()
                            .trim(),

                        email
                            .toString()
                            .trim(),

                        passwordHash,

                        role
                            .toString()
                            .trim()
                            .toLowerCase(),

                        employmentType || null,

                        department || null,

                        joiningDate || null,

                        status || "Active",

                        mentorId || null

                    ]

                );


            const user =
                result.rows[0];


            // ==========================================
            // CONVERT TO ANGULAR FORMAT
            // ==========================================

            const formattedUser = {

                id:
                    user.id,

                name:
                    user.name,

                email:
                    user.email,

                role:
                    user.role,

                employmentType:
                    user.employment_type || "",

                department:
                    user.department || "",

                joiningDate:
                    user.joining_date || "",

                status:
                    user.status || "Active",

                mentorId:
                    user.mentor_id || null

            };


            // ==========================================
            // RESPONSE
            // ==========================================

            res.status(201).json({

                message:
                    "Employee Added Successfully",

                user:
                    formattedUser

            });


        } catch (error) {

            console.error(
                "ADD USER DATABASE ERROR:",
                error
            );


            res.status(500).json({

                message:
                    "Unable to add employee.",

                error:
                    error.message

            });

        }

    }
);


//13. UPDATE USER - PostgreSQL

app.put("/users/:id", authenticateToken, authorizeRoles("admin"), async (req, res) => {

    try {

        const id = parseInt(req.params.id);

        if (isNaN(id)) {

            return res.status(400).json({

                message: "Invalid employee ID"

            });

        }

        const {
            name,
            email,
            role,
            employmentType,
            department,
            joiningDate,
            mentorId,
            status
        } = req.body;


        // Check if employee exists

        const existingUser = await pool.query(

            `
            SELECT *
            FROM users
            WHERE id = $1
            `,

            [id]

        );


        if (existingUser.rows.length === 0) {

            return res.status(404).json({

                message: "Employee not found"

            });

        }


        // Check if another user already has this email

        const duplicateEmail = await pool.query(

            `
            SELECT id
            FROM users
            WHERE LOWER(email) = LOWER($1)
            AND id <> $2
            `,

            [email, id]

        );


        if (duplicateEmail.rows.length > 0) {

            return res.status(400).json({

                message: "Email already exists"

            });

        }


        // Update PostgreSQL

        const result = await pool.query(

            `
            UPDATE users

            SET
                name = $1,
                email = $2,
                role = $3,
                employment_type = $4,
                department = $5,
                joining_date = $6,
                mentor_id = $7,
                status = $8

            WHERE id = $9

            RETURNING
                id,
                name,
                email,
                role,
                employment_type,
                department,
                joining_date,
                status,
                mentor_id,
                archive_reason,
                archived_on,
                archived_by
            `,

            [
                name,
                email,
                role,
                employmentType || null,
                department || null,
                joiningDate || null,
                mentorId || null,
                status || "Active",
                id
            ]

        );


        const user = result.rows[0];


        // Convert PostgreSQL names to Angular names

        const formattedUser = {

            id: user.id,

            name: user.name,

            email: user.email,

            role: user.role,

            employmentType:
                user.employment_type || "",

            department:
                user.department || "",

            joiningDate:
                user.joining_date || "",

            status:
                user.status || "Active",

            mentorId:
                user.mentor_id || null,

            archiveReason:
                user.archive_reason || "",

            archivedOn:
                user.archived_on || "",

            archivedBy:
                user.archived_by || ""

        };


        res.json({

            message: "Employee Updated",

            user: formattedUser

        });


    } catch (error) {

        console.error(
            "UPDATE USER DATABASE ERROR:",
            error
        );

        res.status(500).json({

            message: "Error updating employee"

        });

    }

});


//14. ARCHIVE USER - PostgreSQL

app.put("/users/archive/:id", authenticateToken, authorizeRoles("admin"), async (req, res) => {

    try {

        const id = parseInt(req.params.id);

        if (isNaN(id)) {

            return res.status(400).json({
                message: "Invalid employee ID"
            });

        }

        const {
            archiveReason,
            archivedBy
        } = req.body;


        // Check employee exists

        const existingUser = await pool.query(

            `
            SELECT id
            FROM users
            WHERE id = $1
            `,

            [id]

        );


        if (existingUser.rows.length === 0) {

            return res.status(404).json({
                message: "Employee not found"
            });

        }


        // Archive employee in PostgreSQL

        const result = await pool.query(

            `
            UPDATE users

            SET
                status = 'Archived',
                archive_reason = $1,
                archived_on = CURRENT_DATE,
                archived_by = $2

            WHERE id = $3

            RETURNING
                id,
                name,
                email,
                role,
                employment_type,
                department,
                joining_date,
                status,
                mentor_id,
                archive_reason,
                archived_on,
                archived_by
            `,

            [
                archiveReason || "Archived by Admin",
                archivedBy || "Admin",
                id
            ]

        );


        const user = result.rows[0];


        // Convert PostgreSQL fields to Angular fields

        const formattedUser = {

            id: user.id,

            name: user.name,

            email: user.email,

            role: user.role,

            employmentType:
                user.employment_type || "",

            department:
                user.department || "",

            joiningDate:
                user.joining_date || "",

            status:
                user.status || "Archived",

            mentorId:
                user.mentor_id || null,

            archiveReason:
                user.archive_reason || "",

            archivedOn:
                user.archived_on || "",

            archivedBy:
                user.archived_by || ""

        };


        res.json({

            message: "Employee Archived",

            user: formattedUser

        });


    } catch (error) {

        console.error(
            "ARCHIVE USER DATABASE ERROR:",
            error
        );

        res.status(500).json({

            message: "Error archiving employee"

        });

    }

});


//15. RESTORE USER - PostgreSQL

app.put("/users/restore/:id", authenticateToken, authorizeRoles("admin"), async (req, res) => {

    try {

        const id = parseInt(req.params.id);

        if (isNaN(id)) {

            return res.status(400).json({
                message: "Invalid employee ID"
            });

        }

        // Check employee exists

        const existingUser = await pool.query(

            `
            SELECT id
            FROM users
            WHERE id = $1
            `,

            [id]

        );

        if (existingUser.rows.length === 0) {

            return res.status(404).json({
                message: "Employee not found"
            });

        }

        // Restore employee in PostgreSQL

        const result = await pool.query(

            `
            UPDATE users

            SET
                status = 'Active',
                archive_reason = NULL,
                archived_on = NULL,
                archived_by = NULL

            WHERE id = $1

            RETURNING
                id,
                name,
                email,
                role,
                employment_type,
                department,
                joining_date,
                status,
                mentor_id,
                archive_reason,
                archived_on,
                archived_by
            `,

            [id]

        );

        const user = result.rows[0];

        // Convert PostgreSQL fields to Angular fields

        const formattedUser = {

            id: user.id,

            name: user.name,

            email: user.email,

            role: user.role,

            employmentType:
                user.employment_type || "",

            department:
                user.department || "",

            joiningDate:
                user.joining_date || "",

            status:
                user.status || "Active",

            mentorId:
                user.mentor_id || null,

            archiveReason:
                user.archive_reason || "",

            archivedOn:
                user.archived_on || "",

            archivedBy:
                user.archived_by || ""

        };

        res.json({

            message: "Employee Restored",

            user: formattedUser

        });

    } catch (error) {

        console.error(
            "RESTORE USER DATABASE ERROR:",
            error
        );

        res.status(500).json({

            message: "Error restoring employee"

        });

    }

});



// DB TEST
app.get('/db-test', async (req, res) => {

    try {

        const result = await pool.query(
            'SELECT NOW() AS current_time'
        );

        res.json({
            success: true,
            message: 'PostgreSQL connection successful',
            time: result.rows[0].current_time
        });

    } catch (error) {

        console.error('Database test failed:', error);

        res.status(500).json({
            success: false,
            message: 'PostgreSQL connection failed'
        });

    }

});


app.get('/health', async (req, res) => {

    try {

        const result = await pool.query(
            'SELECT NOW() AS database_time'
        );

        res.json({
            server: 'OK',
            database: 'Connected',
            databaseTime: result.rows[0].database_time
        });

    } catch (error) {

        console.error('Health check failed:', error);

        res.status(500).json({
            server: 'OK',
            database: 'Disconnected'
        });

    }

});


app.get('/reports/employee/:employeeId', async (req, res) => {

    const employeeId = Number(req.params.employeeId);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return res.status(400).json({
            message: 'Invalid employee ID'
        });
    }

    const client = await pool.connect();

    const cursorName = `employee_reports_${Date.now()}`;

    try {

        await client.query('BEGIN');

        await client.query(
            'CALL get_employee_reports($1, $2)',
            [employeeId, cursorName]
        );

        const result = await client.query(
            `FETCH ALL FROM "${cursorName}"`
        );

        await client.query('COMMIT');

        res.json(result.rows);

    } catch (error) {

        await client.query('ROLLBACK');

        console.error('Stored Procedure Error:', error);

        res.status(500).json({
            message: 'Unable to fetch employee reports'
        });

    } finally {

        client.release();

    }

});


// START SERVER
async function startServer() {

    try {

        // Actually test PostgreSQL
        await pool.query('SELECT NOW()');

        console.log("PostgreSQL Connected");

        app.listen(3000, () => {

            console.log(
                "Server running on http://localhost:3000"
            );

        });

    } catch (error) {

        console.error("PostgreSQL connection failed:");
        console.error(error.message);

    }

}

startServer();