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


//3. CREATE REPORT
app.post("/reports",authenticateToken, (req, res) => {

    const report = req.body;

    // Check if employee exists
const users = getUsers();

const employee = users.find(user =>
    user.email.toLowerCase() === report.employeeEmail.toLowerCase()
);

if (!employee) {

    return res.status(400).json({

        message: "Employee does not exist. Please add the employee first."

    });

}

    console.log("POST ROUTE EXECUTED");

    let reports = [];
    console.log("Incoming Report:", report);

    if (fs.existsSync(REPORT_FILE)) {

        const data = fs.readFileSync(REPORT_FILE, "utf8");

        if (data.trim() !== "") {
            reports = JSON.parse(data);
        }

    }
    console.log("Existing Reports:", reports);


    //DUPLICATE CHECK 
    //checking if employee name and report dates are same
    console.log("Checking duplicate...");
    const duplicate = reports.find(existing =>

    existing.employeeName &&
    existing.reportDate &&

    isDuplicate(existing, report)

);
    //if duplicate is found, return error message
    if (duplicate) {
        console.log("DUPLICATE FOUND");
        return res.status(400).json({
            message: "Report already exists for this employee on this date."
        });
    }

    //if no duplicate, save the new report into reports.json, by generating new ID. Also produce success message
    
    //generates new unique ID, for existing array
    const newId =
reports.length > 0
? Math.max(...reports.map(r => r.id || 0)) + 1
: 1;

const newReport = {

    id: newId,

    employeeId: report.employeeId || 0,

    employeeName: report.employeeName,

    employeeEmail: report.employeeEmail || "",

    mentorId: report.mentorId || 0,

    department: report.department || "",

    reportDate: report.reportDate,

    task: report.task,

    description: report.description || "",

    progress: report.progress || "",

    hoursWorked: report.hoursWorked || 0,

    status: report.status || "Pending",

    managerRemarks: report.managerRemarks || "",

    submittedAt:
        report.submittedAt || new Date().toISOString()

};

reports.push(newReport);

    fs.writeFileSync(REPORT_FILE, JSON.stringify(reports, null, 2));

    console.log("New Report:", newReport);

res.json({

    message: "Report Saved Successfully",

    report: newReport

});

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

//6. VIEW REPORTS
app.get("/reports", authenticateToken, (req, res) => {

    try {

        let reports = [];

        if (fs.existsSync(REPORT_FILE)) {

            const data = fs.readFileSync(REPORT_FILE, "utf8");

            console.log("File Content:", data);

            if (data.trim() !== "") {
                reports = JSON.parse(data);
            }

        }

        console.log("Parsed Reports:", reports);

        res.json(reports);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Error reading reports",
            error: error.message
        });

    }

});


//7. EXPORT EXCEL
app.get("/export", authenticateToken, (req, res) => {

    try {

        const reports = getReports();

        const worksheet = XLSX.utils.json_to_sheet(reports);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Reports"
        );

        const exportPath = path.join(
            __dirname,
            "InternTrack_Report.xlsx"
        );

        XLSX.writeFile(
            workbook,
            exportPath
        );

        res.download(exportPath);

    }

    catch(error){

        console.error(error);

        res.status(500).json({

            message:"Error exporting Excel"

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

app.get("/users", (req, res) => {

    const users = getUsers();

    res.json(users);

});


//10. EXPORT EMPLOYEES
app.get("/export-users", (req, res) => {

    try {

        const users = getUsers();

        const exportData = users.map(user => ({

            Name: user.name,
            Email: user.email,
            Role: user.role

        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "Employees"
        );

        const filePath = path.join(
            __dirname,
            "InternTrack_Employees.xlsx"
        );

        XLSX.writeFile(workbook, filePath);

        res.download(filePath);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Unable to export employees."
        });

    }

});


//11. IMPORT EMPLOYEES

app.post(
    "/import-users",
    upload.single("file"),
    (req, res) => {

        try {

            const workbook = XLSX.readFile(req.file.path);

            const sheetName = workbook.SheetNames[0];

            const worksheet = workbook.Sheets[sheetName];

            const importedUsers =
                XLSX.utils.sheet_to_json(worksheet);

            let users = getUsers();

            // Remove empty rows
            const validUsers = importedUsers.filter(user =>

                user.Name &&
                user.Email &&
                user.Role

            );

            // Remove duplicate rows inside Excel
            const seenEmails = new Set();

            const uniqueUsers = validUsers.filter(user => {

                const email = user.Email
                    .toString()
                    .trim()
                    .toLowerCase();

                if (seenEmails.has(email)) {

                    return false;

                }

                seenEmails.add(email);

                return true;

            });

            // Remove users already present in database
            const newUsers = uniqueUsers.filter(imported =>

                !users.find(existing =>

                    existing.email.toLowerCase() ===
                    imported.Email.toLowerCase()

                )

            );

            // Generate IDs
            let nextId =
                users.length > 0
                    ? Math.max(...users.map(u => u.id || 0)) + 1
                    : 1;

            newUsers.forEach(user => {

                users.push({

                    id: nextId++,

                    name: user.Name,

                    email: user.Email,

                    password: "123456",

                    role: user.Role.toLowerCase()

                });

            });

            saveUsers(users);

            if (req.file) {

                fs.unlinkSync(req.file.path);

            }

            res.json({

                success: true,

                imported: newUsers.length,

                skipped:

                    validUsers.length -

                    newUsers.length

            });

        }

        catch (error) {

            console.error(error);

            res.status(500).json({

                message: "Employee import failed"

            });

        }

    }

);


//12. CREATE USER

app.post("/users", (req, res) => {

    const users = getUsers();

    const newUser = req.body;

    const exists = users.find(

        user =>
            user.email.toLowerCase() ===
            newUser.email.toLowerCase()

    );

    if (exists) {

        return res.status(400).json({

            message: "Email already exists"

        });

    }

    newUser.id =
        users.length > 0
            ? Math.max(...users.map(u => u.id || 0)) + 1
            : 1;

    // Default values

    newUser.department =
        newUser.department || "";

    newUser.employmentType =
        newUser.employmentType || "";

    newUser.joiningDate =
        newUser.joiningDate || "";

    newUser.status =
        "Active";

    newUser.archiveReason =
        "";

    newUser.archivedOn =
        "";

    newUser.archivedBy =
        "";

    users.push(newUser);

    saveUsers(users);

    res.json({

        message: "Employee Added",

        user: newUser

    });

});

//13. UPDATE USER
app.put("/users/:id", (req, res) => {

    const id = parseInt(req.params.id);

    const users = getUsers();

    const index =
        users.findIndex(user => user.id === id);

    if (index === -1) {

        return res.status(404).json({

            message: "Employee not found"

        });

    }

    users[index] = {

        ...users[index],

        ...req.body,

        id

    };

    saveUsers(users);

    res.json({

        message: "Employee Updated",

        user: users[index]

    });

});


//14. ARCHIVE USER

app.put("/users/archive/:id", (req, res) => {

    const id = parseInt(req.params.id);

    const {

        archiveReason,

        archivedBy

    } = req.body;

    const users = getUsers();

    const user = users.find(

        u => u.id === id

    );

    if (!user) {

        return res.status(404).json({

            message: "Employee not found"

        });

    }

    user.status = "Archived";

    user.archiveReason =
        archiveReason || "";

    user.archivedOn =
        new Date().toISOString().split("T")[0];

    user.archivedBy =
        archivedBy || "Admin";

    saveUsers(users);

    res.json({

        message: "Employee Archived"

    });

});


//15. RESTORE USER

app.put("/users/restore/:id", (req, res) => {

    const id = parseInt(req.params.id);

    const users = getUsers();

    const user =
        users.find(u => u.id === id);

    if (!user) {

        return res.status(404).json({

            message: "Employee not found"

        });

    }

    user.status = "Active";

    user.archiveReason = "";

    user.archivedOn = "";

    user.archivedBy = "";

    saveUsers(users);

    res.json({

        message: "Employee Restored"

    });

});

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