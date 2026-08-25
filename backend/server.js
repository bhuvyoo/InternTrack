//IMPORTS
const express = require("express");
const cors = require("cors");
const pool = require('./db/database');
const fs = require("fs");
const XLSX = require("xlsx");
const multer = require("multer");

//CONSTANTS
const app = express();
const path = require("path");
const REPORT_FILE = path.join(__dirname, "reports.json");
const USER_FILE = path.join(__dirname, "users.json");

//JWT
const jwt = require("jsonwebtoken");
const JWT_SECRET = "interntrack-secret-key";


//MIDDLEWARE
const upload = multer({
    dest: "uploads/"
});

app.use(cors());

app.use(express.json());

//HELPER FUNCTIONS
//1.READ REPORTS
function getReports() {

    let reports = [];

    if (fs.existsSync(REPORT_FILE)) {

        const data = fs.readFileSync(REPORT_FILE, "utf8");

        if (data.trim() !== "") {

            reports = JSON.parse(data);

        }

    }

    return reports;

}

//2. FORMAT EXCEL TO DATE
function formatExcelDate(dateString) {

    if (!dateString) {

        return "";

    }

    const [month, day, year] = dateString.toString().split("/");

    return `20${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

//3. CHECK IF REPORTS ALREADY EXISTS
function isDuplicate(existingReport, importedReport) {

    const existingEmployee =
        (existingReport.employeeName || "")
            .trim()
            .toLowerCase();

    const importedEmployee =
        (importedReport.employeeName || "")
            .trim()
            .toLowerCase();

    const existingTask =
        (existingReport.task || "")
            .trim()
            .toLowerCase();

    const importedTask =
        (importedReport.task || "")
            .trim()
            .toLowerCase();

    const existingDate =
        existingReport.reportDate || "";

    const importedDate =
        importedReport.reportDate || "";

    return (

        existingEmployee === importedEmployee &&

        existingTask === importedTask &&

        existingDate === importedDate

    );

}

//4. CLEAN REPORTS JSON
function cleanReports(reports) {

    const seen = new Set();

    return reports.filter(report => {

        const key = [

            (report.employeeName || "")
                .trim()
                .toLowerCase(),

            report.reportDate || "",

            (report.task || "")
                .trim()
                .toLowerCase()

        ].join("_");

        if (seen.has(key)) {

            return false;

        }

        seen.add(key);

        return true;

    });

}

//5. READ USERS
function getUsers() {

    let users = [];

    if (fs.existsSync(USER_FILE)) {

        const data = fs.readFileSync(USER_FILE, "utf8");

        if (data.trim() !== "") {

            users = JSON.parse(data);

        }

    }

    return users;

}

function saveUsers(users) {

    fs.writeFileSync(

        USER_FILE,

        JSON.stringify(users, null, 2)

    );

}

function authenticateToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Access token required"
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Invalid authorization format"
        });
    }

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

//ROUTES
//1. HOMEROUTE
app.get("/", (req, res) => {
    res.send("InternTrack Backend Running");
});

// 2. LOGIN - PostgreSQL
app.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        // Check that email and password were provided
        if (!email || !password) {

            return res.status(400).json({
                message: "Email and password are required"
            });

        }

        // Find user in PostgreSQL
        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                password,
                department,
                employment_type,
                mentor_id,
                status,
                role
            FROM users
            WHERE LOWER(email) = LOWER($1)
            AND password = $2
            LIMIT 1
            `,
            [email, password]
        );

        // User not found / invalid password
        if (result.rows.length === 0) {

            return res.status(401).json({
                message: "Invalid Username or Password"
            });

        }

        const user = result.rows[0];

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
console.log("JWT GENERATED:", token);

        // Login successful
        res.json({

            message: "Login Successful",

            token: token,

            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                department: user.department || "",
                employmentType: user.employment_type || "",
                mentorId: user.mentor_id || null,
                status: user.status || "Active",
                role: user.role
            }

        });

    } catch (error) {

        console.error("LOGIN DATABASE ERROR:", error);

        res.status(500).json({
            message: "Database error during login"
        });

    }

});


//3. CREATE REPORT - PostgreSQL

app.post("/reports", authenticateToken, async (req, res) => {

    try {

        const report = req.body;

        console.log("POST REPORT - PostgreSQL");
        console.log("Incoming Report:", report);


        // =========================================
        // FIND EMPLOYEE
        // =========================================

        const employeeResult = await pool.query(

            `
            SELECT
                id,
                name,
                email,
                department
            FROM users
            WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
            LIMIT 1
            `,

            [report.employeeEmail]

        );


        if (employeeResult.rows.length === 0) {

            return res.status(400).json({

                message:
                    "Employee does not exist. Please add the employee first."

            });

        }


        const employee = employeeResult.rows[0];


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

                report.mentorId || null,

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

//4. UPDATE REPORT
app.put("/reports/:id", authenticateToken, (req, res) => {

    try {
        //converts the id from string to integer, to match the id in reports.json
        const id = parseInt(req.params.id);

        const updatedReport = req.body;

        let reports = [];

        //to check the existance of the file at REPORT_FILE path and read its content if present
        if (fs.existsSync(REPORT_FILE)) {

            const data = fs.readFileSync(REPORT_FILE, "utf8");

            //to remove the whitespace
            if (data.trim() !== "") {

                reports = JSON.parse(data);

            }

        }

        //to find the reports at that index position
        const index = reports.findIndex(r => r.id === id);
        if (index === -1) {
            return res.status(404).json({
                message: "Report not found"
            });
        }

        reports[index] = {

    ...reports[index],

    ...updatedReport,

    id

};

        fs.writeFileSync(
            REPORT_FILE,
            JSON.stringify(reports, null, 2)
        );

        console.log("Updated Report:", updatedReport);

        res.json({
            message: "Report Updated Successfully"
        });

    }
    catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Error updating report"
        });

    }

});

//5. DELETE REPORT
app.delete("/reports/:id", authenticateToken, (req, res) => {

    try {
        //converts the id from string to integer, to match the id in reports.json
        const id = parseInt(req.params.id);

        let reports = [];

        //to check the existance of the file at REPORT_FILE path
        if (fs.existsSync(REPORT_FILE)) {
            //if present, read its contents
            const data = fs.readFileSync(REPORT_FILE, "utf8");

            if (data.trim() !== "") {

                reports = JSON.parse(data);

            }

        }
        //to find the reports at that index position
        const index = reports.findIndex(report => report.id === id);

        //if the report is not found, return 404 error
        if (index === -1) {

            return res.status(404).json({
                message: "Report not found"
            });

        }

        reports.splice(index, 1);

        fs.writeFileSync(
            REPORT_FILE,
            JSON.stringify(reports, null, 2)
        );

        res.json({
            message: "Report Deleted Successfully"
        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Error deleting report"
        });

    }

});

//6. VIEW REPORTS - PostgreSQL

app.get("/reports", authenticateToken, async (req, res) => {

    try {

        const result = await pool.query(`

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

        `);


        // Convert PostgreSQL fields
        // to the format Angular already expects

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
            "Reports fetched from PostgreSQL:",
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
                "Error fetching reports from database",

            error:
                error.message

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


//8. IMPORT EXCEL
app.post(
    "/import",
    authenticateToken,
    authorizeRoles("admin"),
    upload.single("file"),
    (req, res) => {

        try {

            console.log("Import Route Hit");

            //8.1 Read Excel
            const workbook = XLSX.readFile(req.file.path, {
                cellDates: true
            });

            const sheetName = workbook.SheetNames[0];

            const worksheet = workbook.Sheets[sheetName];

            const importedReports =
            XLSX.utils.sheet_to_json(worksheet, {
        raw: false
    });
            console.log(importedReports);
            console.log(typeof importedReports[0]["Report Date"]);
            console.log(importedReports[0]["Report Date"]);

            //8.2 Normalize Excel columns
            const normalizedReports = importedReports.map(report => ({

    employeeId: 0,

    employeeName:
        report["Employee Name"]?.toString().trim() || "",

    employeeEmail:
        report["Employee Email"]?.toString().trim() || "",

    department:
        report["Department"]?.toString().trim() || "",

    reportDate:
        formatExcelDate(report["Report Date"]),

    task:
        report["Task"]?.toString().trim() || "",

    description:
        report["Description"]?.toString().trim() || "",

    progress:
        report["Progress"]?.toString().trim() || "",

    hoursWorked:
        Number(report["Hours Worked"]) || 0,

    status:
        report["Status"]?.toString().trim() || "Pending",

    managerRemarks:
        report["Manager Remarks"]?.toString().trim() || "",

    submittedAt:
        new Date().toISOString()

}));
            console.log("Normalized Reports:");
            console.log(normalizedReports);

            //8.3 Read existing reports
            let reports = [];

            if (fs.existsSync(REPORT_FILE)) {

                const data = fs.readFileSync(REPORT_FILE, "utf8");

                if (data.trim() !== "") {

                    reports = JSON.parse(data);

                }

            }

            //8.4 Remove empty rows
            const users = getUsers();

const validReports = normalizedReports.filter(report => {

    const employeeExists = users.some(user =>

        user.email.toLowerCase() ===
        report.employeeEmail.toLowerCase()

    );

    return (

        employeeExists &&

        report.employeeName &&
        report.employeeEmail &&
        report.reportDate &&
        report.task &&
        report.description &&
        report.progress &&
        report.hoursWorked >= 0 &&
        report.status

    );

});



            //8.5 REMOVE DUPLICATE ROWS
            const seenKeys = new Set();
            const uniqueReports = validReports.filter(report => {
                const key = [

    report.employeeName
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

console.log("Unique Excel Reports:", uniqueReports.length);
console.log(
    "Duplicate Rows In Excel:",
    validReports.length - uniqueReports.length
);

            //8.6 Find new reports (skip duplicates)
            const newReports = uniqueReports.filter(imported => {

                const duplicate = reports.find(existing =>

                    existing.employeeName &&
                    existing.reportDate &&

                    isDuplicate(existing, imported)

                );

                return !duplicate;

            });

            //DEBUG
            console.log("New Reports:");
            console.table(newReports);

            //8.7 Generate IDs
            let nextId = 1;

            if (reports.length > 0) {

                nextId =
                    Math.max(...reports.map(r => r.id || 0)) + 1;

            }

            newReports.forEach(report => {

                report.id = nextId++;

            });

            //8.8 Merge
            reports.push(...newReports);

            //8.9 Clean Entire Database
            reports = cleanReports(reports);

            //8.10 Save
            fs.writeFileSync(

                REPORT_FILE,

                JSON.stringify(reports, null, 2)

            );

            //8.11 DELETE TEMPORARY EXCEL FILE
            if (req.file) {
                fs.unlinkSync(req.file.path);
                console.log("Temporary Excel File Deleted");
            }
            
            //8.12 IMPORT SUMMARY
            console.log("Existing:", reports.length - newReports.length);

            console.log("Imported:", validReports.length);

            console.log("Added:", newReports.length);

            console.log("Duplicates:",
                validReports.length - newReports.length
            );

            //8.13 SEND RESPONSE
            res.json({

    success: true,

    message: "Import Successful",

    summary: {

    totalRows: importedReports.length,

    validRows: validReports.length,

    missingEmployees: missingEmployees.length,

    excelDuplicates:
        validReports.length - uniqueReports.length,

    databaseDuplicates:
        uniqueReports.length - newReports.length,

    imported: newReports.length,

    totalReports: reports.length

},

    reports: reports

});
        }

        catch (error) {

            console.error(error);

            res.status(500).json({

                message: "Import Failed",

                error: error.message

            });

        }

    }
);


//9. GET USERS

// 9. GET USERS - PostgreSQL
app.get("/users", async (req, res) => {

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

                        "123456",

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



//13. UPDATE USER - PostgreSQL

app.put("/users/:id", async (req, res) => {

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

app.put("/users/archive/:id", async (req, res) => {

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

app.put("/users/restore/:id", async (req, res) => {

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

app.post('/migrate-users', async (req, res) => {

    try {

        const users = getUsers();

        if (!users.length) {

            return res.json({
                success: false,
                message: 'No users found in users.json'
            });

        }

        let imported = 0;
        let skipped = 0;

        for (const user of users) {

            const existing = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [user.email]
            );

            if (existing.rows.length > 0) {

                skipped++;

                continue;
            }

            await pool.query(
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

            imported++;
        }

        res.json({
            success: true,
            message: 'Users migrated successfully',
            imported,
            skipped
        });

    } catch (error) {

        console.error('Migration error:', error);

        res.status(500).json({
            success: false,
            message: 'User migration failed',
            error: error.message
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