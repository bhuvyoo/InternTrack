// =========================================================
// REPORT VALIDATION MIDDLEWARE
// =========================================================

function validateReport(req, res, next) {

    try {

        const {

            employeeEmail,
            reportDate,
            task,
            description,
            progress,
            hoursWorked,
            status

        } = req.body;


        // =================================================
        // EMPLOYEE EMAIL
        // =================================================

        if (
            !employeeEmail ||
            !employeeEmail.toString().trim()
        ) {

            return res.status(400).json({

                message:
                    "Employee email is required."

            });

        }


        // Basic email validation

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
            !emailPattern.test(
                employeeEmail.toString().trim()
            )
        ) {

            return res.status(400).json({

                message:
                    "Please provide a valid employee email."

            });

        }


        // =================================================
        // REPORT DATE
        // =================================================

        if (!reportDate) {

            return res.status(400).json({

                message:
                    "Report date is required."

            });

        }


        const date = new Date(reportDate);

        if (isNaN(date.getTime())) {

            return res.status(400).json({

                message:
                    "Please provide a valid report date."

            });

        }


        // =================================================
        // TASK
        // =================================================

        if (
            !task ||
            !task.toString().trim()
        ) {

            return res.status(400).json({

                message:
                    "Task is required."

            });

        }


        // =================================================
        // DESCRIPTION
        // =================================================

        if (
            !description ||
            !description.toString().trim()
        ) {

            return res.status(400).json({

                message:
                    "Report description is required."

            });

        }


        // =================================================
        // HOURS WORKED
        // =================================================

        const hours =
            Number(hoursWorked);


        if (

            !Number.isFinite(hours) ||

            hours <= 0 ||

            hours > 24

        ) {

            return res.status(400).json({

                message:
                    "Hours worked must be greater than 0 and cannot exceed 24 hours."

            });

        }


        // =================================================
        // PROGRESS
        // =================================================

        if (

            progress &&

            progress.toString().trim().length > 100

        ) {

            return res.status(400).json({

                message:
                    "Progress must not exceed 100 characters."

            });

        }


        // =================================================
        // STATUS
        // =================================================

        const allowedStatuses = [

            "Pending",
            "In Review",
            "Approved",
            "Rejected"

        ];


        if (

            status &&

            !allowedStatuses.includes(status)

        ) {

            return res.status(400).json({

                message:
                    "Invalid report status."

            });

        }


        // =================================================
        // VALIDATION SUCCESSFUL
        // =================================================

        next();


    } catch (error) {

        console.error(

            "REPORT VALIDATION ERROR:",

            error.message

        );


        return res.status(400).json({

            message:
                "Invalid report data."

        });

    }

}


// =========================================================
// EXPORT
// =========================================================

module.exports = validateReport;