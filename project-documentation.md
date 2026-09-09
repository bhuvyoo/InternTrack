# InternTrack

### Internship Management Portal

InternTrack is a full-stack internship management platform designed to
simplify the management, monitoring and evaluation of interns through a
centralized web-based system.

The platform provides separate role-based portals for:

- Administrator
- Mentor
- Employee / Intern

The system manages employee information, internship progress, daily reports,
mentor assignments, approvals and account authentication.

---

# 1. Project Overview

InternTrack was developed as a full-stack web application using Angular,
Node.js, Express.js and PostgreSQL.

The application follows a client-server architecture:

Angular Frontend
       ↓
   REST APIs
       ↓
Node.js + Express Backend
       ↓
PostgreSQL Database


Authentication and authorization are handled using JWT-based authentication
and role-based access control.

---

# 2. Main Features

## Admin Portal

* Admin dashboard
* Employee management
* Add employee
* Edit employee
* Archive/restore employee
* Employee search
* Employee profile management
* Mentor management
* Progress monitoring
* Report monitoring
* Report approval/rejection
* Pagination
* Role-based access

## Mentor Portal

* Mentor dashboard
* Assigned employee management
* Employee progress monitoring
* Report review
* Report approval/rejection
* Mentor profile

## Employee Portal

* Employee dashboard
* Employee profile
* Assigned mentor information
* Daily progress/report submission
* Report history
* Report status tracking
* Profile editing

## Authentication

* Login
* JWT authentication
* Role-based authorization
* Session/inactivity timeout
* Forgot Password
* Reset Password
* Secure password hashing
* Password reset token expiry
* Password reset token invalidation

---

# 3. Technology Stack

## Frontend

* Angular
* TypeScript
* HTML5
* CSS3
* Angular Reactive Forms
* Angular Router
* HttpClient
* RxJS
* Font Awesome
* File Saver
* XLSX
* jsPDF
* jsPDF AutoTable

## Backend

* Node.js
* Express.js
* REST APIs
* JWT
* bcrypt
* Node.js Crypto module
* Multer
* XLSX

## Database

* PostgreSQL

## Development Tools

* Visual Studio Code
* Git
* GitHub
* Postman
* pgAdmin
* npm

---

# 4. System Requirements

Install the following before running InternTrack:

* Node.js
* npm
* Angular CLI
* PostgreSQL
* pgAdmin (recommended)
* Visual Studio Code

## Verify Node.js

```bash
node --version
```

## Verify npm

```bash
npm --version
```

## Verify Angular CLI

```bash
ng version
```

## Verify PostgreSQL

```bash
psql --version
```

---

# 5. Project Structure

InternTrack/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── db/
│   │   └── database.js
│   ├── server.js
│   ├── package.json
│   └── uploads/
│
├── documentation/
│   └── PROJECT_DOCUMENTATION.md
│
├── presentation/
│   └── InternTrack_Final_Presentation.pptx
│
├── README.md
└── .gitignore

---

# 6. Database Setup

InternTrack uses PostgreSQL as its primary relational database.

## Step 1 — Install PostgreSQL

Install PostgreSQL and make sure the PostgreSQL service is running.

The default configuration used during local development is:

Host: localhost
Port: 5432

---

## Step 2 — Create the Database

Open PostgreSQL or pgAdmin and create a database named:

Interntrack

Using PostgreSQL:

```sql
CREATE DATABASE interntrack;
```

---

## Step 3 — Configure the Backend Database Connection

The PostgreSQL connection is configured in:

backend/db/database.js

The connection contains the following details:

Host: localhost
Port: 5432
Database: Interntrack
Username: postgres
Password: <your-password>

Replace <your-password> with the password configured for the local
PostgreSQL installation.

---

## Step 4 — Database Tables

The required tables should be available in the PostgreSQL database used by
the application.

The main application data includes:

Users
Employee information
Mentor assignments
Internship reports
Password reset tokens

The users table stores authentication and employee-related information.

The reports table stores internship progress reports and their status.

The password_reset_tokens table stores hashed password-reset tokens and
their expiry/usage information.

---

## Step 5 — Verify Database Connectivity

Start the backend:

cd backend
node server.js

The backend provides a database test endpoint:

GET /db-test

---

# 7. Backend Setup

Open a terminal and navigate to the backend:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
node server.js
```

The backend runs on:

http://localhost:3000

If the project contains an npm start script, the backend can also be started
using:

```bash
npm start
```

---

# 8. Frontend Setup

Open a second terminal.

Navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the Angular development server:

```bash
ng serve
```

The frontend runs on:

http://localhost:4200


Open the application in a browser:

http://localhost:4200


---

# 9. Running the Complete Application

The application requires three components:

PostgreSQL
    ↓
Node.js + Express Backend
    ↓
Angular Frontend


### Terminal 1 — Backend

```bash
cd backend
npm install
node server.js
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
ng serve
```

### Application

Open:

http://localhost:4200


---

# 10. Authentication Flow

InternTrack uses JWT-based authentication.

User
 ↓
Login Page
 ↓
POST /login
 ↓
Backend Credential Validation
 ↓
JWT Generation
 ↓
JWT Returned to Frontend
 ↓
Token Stored
 ↓
Role-Based Dashboard


The supported roles are:


Admin
Mentor
Employee


Protected API requests include the JWT token in the Authorization header:

Authorization: Bearer <JWT_TOKEN>


The backend verifies the JWT before allowing access to protected resources.

---

# 11. Role-Based Access

InternTrack provides different functionality depending on the authenticated
user's role.


                    Login
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
        Admin       Mentor     Employee
          │           │           │
          ↓           ↓           ↓
      Admin        Mentor       Employee
      Portal       Portal        Portal


### Admin

Can manage employees, monitor reports and view overall internship progress.

### Mentor

Can view assigned employees and review their submitted reports.

### Employee

Can manage their profile and submit and track internship reports.

---

# 12. API Endpoints

## Health / Database

| Method | Endpoint   | Description                   |
| ------ | ---------- | ----------------------------- |
| GET    | `/health`  | Checks backend health         |
| GET    | `/db-test` | Tests PostgreSQL connectivity |

## Authentication

| Method | Endpoint           | Description                               |
| ------ | ------------------ | ----------------------------------------- |
| POST   | `/login`           | Authenticates a user and returns a JWT    |
| POST   | `/forgot-password` | Initiates password recovery               |
| POST   | `/reset-password`  | Resets password using a valid reset token |

## Reports

| Method | Endpoint                        | Description                       |
| ------ | ------------------------------- | --------------------------------- |
| GET    | `/reports`                      | Retrieves reports                 |
| POST   | `/reports`                      | Creates a report                  |
| PUT    | `/reports/:id`                  | Updates a report                  |
| DELETE | `/reports/:id`                  | Deletes a report                  |
| GET    | `/reports/employee/:employeeId` | Retrieves reports for an employee |
| GET    | `/export`                       | Exports reports                   |
| POST   | `/import`                       | Imports reports                   |

## Users / Employees

| Method | Endpoint             | Description               |
| ------ | -------------------- | ------------------------- |
| GET    | `/users`             | Retrieves users           |
| GET    | `/users/:id`         | Retrieves a specific user |
| POST   | `/users`             | Creates a user            |
| PUT    | `/users/:id`         | Updates a user            |
| PUT    | `/users/archive/:id` | Archives a user           |
| PUT    | `/users/restore/:id` | Restores an archived user |
| GET    | `/export-users`      | Exports employee data     |

> All protected endpoints require valid authentication and appropriate
> role authorization.

---

# 13. Password Recovery

InternTrack provides a secure password recovery workflow.

Forgot Password
       ↓
Enter Email
       ↓
POST /forgot-password
       ↓
Check User in PostgreSQL
       ↓
Generate Secure Reset Token
       ↓
Hash Token using SHA-256
       ↓
Store Token Hash
       ↓
Generate Reset Link
       ↓
Reset Password


Reset tokens:

* Are randomly generated
* Are stored as SHA-256 hashes
* Expire after 15 minutes
* Can only be used once
* Previous unused tokens are invalidated when a new request is generated

---

# 14. Test Credentials

Use the development/test accounts configured in the database.

## Admin

Email: <ADMIN_TEST_EMAIL>
Password: <ADMIN_TEST_PASSWORD>


## Mentor

Email: <MENTOR_TEST_EMAIL>
Password: <MENTOR_TEST_PASSWORD>


## Employee

Email: <EMPLOYEE_TEST_EMAIL>
Password: <EMPLOYEE_TEST_PASSWORD>


```text
> Replace the placeholders with the actual test credentials before final
> submission.
```

Do not publish real production credentials.

---

# 15. API Testing with Postman

Postman can be used to test the backend independently from the Angular
frontend.

Recommended testing sequence:

1. Start PostgreSQL
2. Start backend
3. Send POST /login
4. Copy the returned JWT
5. Add JWT to Authorization header
6. Test protected APIs
7. Test report operations
8. Test user operations
9. Test Forgot Password
10. Test Reset Password


Authorization header:

Authorization: Bearer <JWT_TOKEN>

---

# 16. Security Implementation

InternTrack implements multiple security mechanisms.

## JWT Authentication

JWT is used to authenticate users and protect API endpoints.

Login
 ↓
JWT Generated
 ↓
Frontend Stores Token
 ↓
Interceptor Adds Token
 ↓
Backend Verifies Token


## Role-Based Authorization

The backend checks the authenticated user's role before granting access to
restricted operations.

## Password Hashing

Passwords are hashed using bcrypt before being stored in PostgreSQL.

Password
   ↓
bcrypt
   ↓
Password Hash
   ↓
PostgreSQL


Plain-text passwords are not stored.

## Password Reset Token Hashing

Password reset tokens are generated using a cryptographically secure random
generator.

The token is hashed using SHA-256 before storage.

## Token Expiration

Password reset tokens expire after 15 minutes.

## One-Time Token Usage

After a successful password reset, the token is marked as used and cannot
be reused.

## AES-256-GCM

AES-256-GCM is implemented for application-level encryption of sensitive
data where required.

AES-GCM provides both encryption and authentication of the encrypted data.

## Session Timeout

The application includes inactivity-based session timeout functionality.
Users are logged out after the configured period of inactivity.

---

# 17. Security Considerations

The current implementation is a development/internship project.

For production deployment, the following should be implemented:

* HTTPS/TLS
* Environment variables for secrets
* Secure JWT secret management
* Secure AES encryption-key management
* Production database credentials
* Production CORS configuration
* Secure email service for password recovery
* Rate limiting
* Security headers
* Production logging and monitoring

Database passwords, JWT secrets, encryption keys and other sensitive
configuration values should never be committed to the repository.

---

# 18. Validation and Error Handling

Validation is implemented on both the frontend and backend.

Examples include:

* Required fields
* Email validation
* Password validation
* Duplicate email detection
* Invalid credentials
* Invalid JWT
* Unauthorized role access
* Invalid reset tokens
* Expired reset tokens
* Already-used reset tokens

The application also provides user-friendly notifications for successful
operations and errors.

---

# 19. Testing

The following areas were tested during development:

### Authentication

* Valid login
* Invalid login
* Role-based redirection
* JWT-protected requests
* Session timeout

### Employee Management

* Add employee
* Edit employee
* Search employee
* Archive employee
* Restore employee
* Export employee data

### Reports

* Submit report
* View reports
* Update report
* Delete report
* Approve report
* Reject report
* Import/export reports

### Password Recovery

* Existing email
* Non-existing email
* Valid reset token
* Invalid reset token
* Expired reset token
* Used reset token
* Password validation

### Database

* PostgreSQL connectivity
* User records
* Report records
* Foreign-key relationships
* Data retrieval and updates

---

# 20. Troubleshooting

## Backend does not start

Check:

- Node.js installation
- npm dependencies
- PostgreSQL status
- Database credentials
- Port 3000 availability


Run:

```bash
cd backend
npm install
node server.js
```

---

## Frontend does not start

Run:

```bash
cd frontend
npm install
ng serve
```

---

## Database connection error

Verify:

Host: localhost
Port: 5432
Database: interntrack
Username: postgres
Password: <your-password>

Also make sure PostgreSQL is running.

---

## Login does not work

Check:

1. PostgreSQL is running.
2. Backend is running on port 3000.
3. The user exists in PostgreSQL.
4. The correct email/password is being used.
5. The frontend is calling the correct backend URL.

---

# 21. Future Enhancements

Possible future improvements include:

* Real email delivery for password recovery
* Production deployment
* Cloud PostgreSQL
* Attendance management
* Automated notifications
* Advanced analytics
* Audit logging
* Document management
* Internship evaluation forms
* Advanced performance reports
* Production monitoring

---

# 22. Conclusion

InternTrack provides a centralized platform for managing internship activities,
employees, mentors and internship progress.

The project demonstrates the practical implementation of:

* Angular frontend development
* Node.js and Express backend development
* REST API communication
* PostgreSQL database integration
* JWT authentication
* Role-based authorization
* bcrypt password hashing
* Secure password recovery
* AES-256-GCM encryption
* Input validation
* Session timeout
* Report management
* Employee management

The final system provides separate Admin, Mentor and Employee experiences
while maintaining centralized authentication, authorization and data
management.

