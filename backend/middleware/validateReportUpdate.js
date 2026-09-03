// =========================================================
// REPORT UPDATE VALIDATION MIDDLEWARE
// =========================================================

function validateReportUpdate(req, res, next) {

    try {

        const report = req.body;


        // =================================================
        // REPORT DATE
        // Validate only if being updated
        // =================================================

        if (report.reportDate !== undefined) {

            if (!report.reportDate) {

                return res.status(400).json({

                    message:
                        "Report date cannot be empty."

                });

            }


            const date =
                new Date(report.reportDate);


            if (isNaN(date.getTime())) {

                return res.status(400).json({

                    message:
                        "Please provide a valid report date."

                });

            }

        }


        // =================================================
        // TASK
        // =================================================

        if (report.task !== undefined) {

            if (
                !report.task ||
                !report.task.toString().trim()
            ) {

                return res.status(400).json({

                    message:
                        "Task cannot be empty."

                });

            }

        }


        // =================================================
        // DESCRIPTION
        // =================================================

        if (report.description !== undefined) {

            if (
                !report.description ||
                !report.description.toString().trim()
            ) {

                return res.status(400).json({

                    message:
                        "Report description cannot be empty."

                });

            }

        }


        // =================================================
        // HOURS WORKED
        // =================================================

        if (report.hoursWorked !== undefined) {

            const hours =
                Number(report.hoursWorked);


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

        }


        // =================================================
        // PROGRESS
        // =================================================

        if (
            report.progress !== undefined &&
            report.progress !== null &&
            report.progress.toString().trim().length > 100
        ) {

            return res.status(400).json({

                message:
                    "Progress must not exceed 100 characters."

            });

        }


        // =================================================
        // STATUS
        // =================================================

        if (report.status !== undefined) {

            const allowedStatuses = [

                "Pending",
                "In Review",
                "Approved",
                "Rejected"

            ];


            if (
                !allowedStatuses.includes(
                    report.status
                )
            ) {

                return res.status(400).json({

                    message:
                        "Invalid report status."

                });

            }

        }


        // =================================================
        // VALIDATION SUCCESS
        // =================================================

        next();


    } catch (error) {

        console.error(

            "REPORT UPDATE VALIDATION ERROR:",

            error.message

        );


        return res.status(400).json({

            message:
                "Invalid report update data."

        });

    }

}


// =========================================================
// EXPORT
// =========================================================

module.exports = validateReportUpdate;