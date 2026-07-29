//IMPORTS
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const XLSX = require("xlsx");
const multer = require("multer");

//CONSTANTS
const app = express();
const path = require("path");
const REPORT_FILE = path.join(__dirname, "reports.json");
const USER_FILE = path.join(__dirname, "users.json");


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

    return (

        existingReport.employeeName?.trim().toLowerCase() ===
        importedReport.employeeName?.trim().toLowerCase()

        &&

        existingReport.reportDate ===
        importedReport.reportDate

        &&

        existingReport.task?.trim().toLowerCase()===
        importedReport.task?.trim().toLowerCase()

    );

}

//4. CLEAN REPORTS JSON
function cleanReports(reports) {

    const seen = new Set();

    return reports.filter(report => {

        const key =

            report.employeeName.trim().toLowerCase()

            + "_"

            + report.reportDate

            + "_"

            + report.task.trim().toLowerCase();

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

//ROUTES
//1. HOMEROUTE
app.get("/", (req, res) => {
    res.send("InternTrack Backend Running");
});

//2. LOGIN
app.post("/login", (req, res) => {

    const { email, password } = req.body;

    const users = getUsers();

    const user = users.find(

        u =>

            u.email.toLowerCase() === email.toLowerCase() &&

            u.password === password

    );

    //if user not found (or) invalid password or email, return error
    if (!user) {

        return res.status(401).json({

            message: "Invalid Username or Password"

        });

    }
    
    //if the user is found, return success message and user data
    res.json({

        message: "Login Successful",

        user: {

            id: user.id,

            name: user.name,

            email: user.email,

            role: user.role

        }

    });

});

//3. CREATE REPORT
app.post("/reports", (req, res) => {

    const report = req.body;

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
    const newId = reports.length > 0 ? Math.max(...reports.map(r => r.id || 0)) + 1 : 1;
    report.id = newId;
    console.log("Saving Report:", report);
    reports.push(report);

    fs.writeFileSync(REPORT_FILE, JSON.stringify(reports, null, 2));

    console.log("New Report:", report);

    res.json({
        message: "Report Saved Successfully",
        report: report
    });

});

//4. UPDATE REPORT
app.put("/reports/:id", (req, res) => {

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

        updatedReport.id=id;
        //update old records into new records
        reports[index] = updatedReport;

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
app.delete("/reports/:id", (req, res) => {

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
app.get("/reports", (req, res) => {

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
app.get("/export", (req, res) => {

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
                employeeName: report["Employee Name"]?.toString().trim(),reportDate: formatExcelDate(
                    report["Report Date"]
                ),
                task: report["Task"]?.toString().trim(),
                progress: report["Progress"]?.toString().trim(),
                status: report["Status"]?.toString().trim()
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
            const validReports = normalizedReports.filter(report =>

                report.employeeName &&
                report.reportDate &&
                report.task &&
                report.progress &&
                report.status

            );

            //8.5 REMOVE DUPLICATE ROWS
            const seenKeys = new Set();
            const uniqueReports = validReports.filter(report => {
                const key = report.employeeName.trim().toLowerCase() +"_" +report.reportDate;
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

app.get("/users",(req,res)=>{

    const users = getUsers();

    const safeUsers = users.map(user=>({

        id:user.id,

        name:user.name,

        email:user.email,

        role:user.role

    }));

    res.json(safeUsers);

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
            ? Math.max(...users.map(u => u.id)) + 1
            : 1;

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

    const index = users.findIndex(

        user => user.id === id

    );

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

        message: "Employee Updated"

    });

});

//14. DELETE USER

app.delete("/users/:id", (req, res) => {

    const id = parseInt(req.params.id);

    let users = getUsers();

    const exists = users.find(user => user.id === id);

    if (!exists) {

        return res.status(404).json({

            message: "Employee not found"

        });

    }

    users = users.filter(user => user.id !== id);

    saveUsers(users);

    res.json({

        message: "Employee Deleted"

    });

});

//START SERVER
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});