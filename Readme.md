# InternTrack

### Internship Management Portal

InternTrack is a full-stack internship management platform designed to simplify
the management, monitoring and evaluation of interns through a centralized
web-based system.

The platform provides separate role-based portals for:

- Administrator
- Mentor
- Employee / Intern

The system manages employee information, internship progress, daily reports,
mentor assignments, approvals and account authentication.

---

## 1. Project Overview

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

## 2. Main Features

### Admin Portal

- Admin dashboard
- Employee management
- Add employee
- Edit employee
- Archive/restore employee
- Employee search
- Employee profile management
- Mentor management
- Progress monitoring
- Report monitoring
- Report approval/rejection
- Pagination
- Role-based access

### Mentor Portal

- Mentor dashboard
- Assigned employee management
- Employee progress monitoring
- Report review
- Report approval/rejection
- Mentor profile

### Employee Portal

- Employee dashboard
- Employee profile
- Assigned mentor information
- Daily progress/report submission
- Report history
- Report status tracking
- Profile editing

### Authentication

- Login
- JWT authentication
- Role-based authorization
- Session/inactivity timeout
- Forgot Password
- Reset Password
- Secure password hashing
- Password reset token expiry
- Password reset token invalidation

---

# 3. Technology Stack

## Frontend

- Angular
- TypeScript
- HTML5
- CSS3
- Angular Reactive Forms
- Angular Router
- HttpClient
- RxJS
- Font Awesome

## Backend

- Node.js
- Express.js
- REST APIs
- JWT
- bcrypt
- Node.js Crypto module

## Database

- PostgreSQL

## Development Tools

- Visual Studio Code
- Git
- GitHub
- Postman
- npm

---

# 4. System Requirements

Install the following before running InternTrack:

- Node.js
- npm
- Angular CLI
- PostgreSQL
- Visual Studio Code

Verify Node.js:

```bash
node --version

Verify npm:

npm --version

Verify Angular CLI:

ng version

Verify PostgreSQL:

psql --version