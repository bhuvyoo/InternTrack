// =========================================================
// CENTRALIZED ERROR HANDLER
// =========================================================

function errorHandler(err, req, res, next) {

    console.error(
        "CENTRALIZED SERVER ERROR:",
        err
    );


    const statusCode =
        err.statusCode || 500;


    const message =
        err.message ||
        "Internal server error";


    res.status(statusCode).json({

        success: false,

        message: message

    });

}


module.exports = errorHandler;