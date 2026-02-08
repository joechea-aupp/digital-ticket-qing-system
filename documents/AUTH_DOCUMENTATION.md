# Login & User Management System Documentation

## Overview
A complete authentication and user management system has been implemented for the ticket queue application with support for two roles: **Admin** and **Agent**.

## Features

### 1. Authentication System
- **Login Page**: Secure login interface at `/login`
- **Password Hashing**: All passwords are securely hashed using bcrypt
- **Session Management**: User sessions are maintained for 24 hours
- **Logout**: Clean session termination

### 2. User Roles
- **Admin**: Full access to all features including user management
- **Agent**: Can access ticket queue, stations management, and admin panel

### 3. Database
- **SQLite Database**: File-based database (`db/queue.db`)
- **Users Table**: Stores username, hashed password, role, and creation timestamp
- **No plaintext passwords**: All passwords are encrypted using bcrypt

### 4. User Management (Admin Only)
- **Create Users**: Add new admin or agent accounts
- **View Users**: List all users with their roles and creation dates
- **Edit Users**: Update username and role
- **Delete Users**: Remove user accounts (cannot delete own account)
- **Change Password**: All users can change their own password

## Quick Start

### Initial Admin User
An initial admin account is automatically created during seeding:
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: `admin`

⚠️ **IMPORTANT**: Change the admin password immediately after first login!

### Login
1. Navigate to `http://localhost:8080/login`
2. Enter your username and password
3. Click "Login"
4. You will be redirected to the dashboard

### Access Control

#### Public Routes (No Authentication Required)
- `GET /` - Get ticket page
- `GET /health` - Health check endpoint

#### Protected Routes (Authentication Required)
- `GET /dashboard` - User dashboard
- `GET /admin` - Admin panel
- `GET /stations` - Station management
- `GET /station-view/:id` - Individual station view

#### Admin Only Routes
- `GET /users` - User management page
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

#### All Authenticated Users
- `POST /api/change-password` - Change own password
- `GET /logout` - Logout and destroy session

## API Endpoints

### Authentication Routes

#### Login
```
POST /login
Content-Type: application/x-www-form-urlencoded

username=<username>&password=<password>

Response: Redirect to /dashboard on success, redirect to /login with error on failure
```

#### Logout
```
GET /logout

Response: Redirect to /login
```

#### Change Password
```
POST /api/change-password
Content-Type: application/json

{
    "currentPassword": "old_password",
    "newPassword": "new_password"
}

Response:
{
    "message": "Password changed successfully"
}
```

### User Management Routes (Admin Only)

#### Create User
```
POST /api/users
Content-Type: application/json

{
    "username": "newuser",
    "password": "password123",
    "role": "admin" | "agent"
}

Response:
{
    "id": 2,
    "username": "newuser",
    "role": "admin"
}
```

#### Get All Users
```
GET /users

Response: Renders users.handlebars with all users
```

#### Get User Details
```
GET /api/users/:id

Response:
{
    "id": 1,
    "username": "admin",
    "role": "admin",
    "created_at": "2025-02-08T09:10:15.000Z"
}
```

#### Update User
```
PUT /api/users/:id
Content-Type: application/json

{
    "username": "updated_username",
    "role": "agent"
}

Response:
{
    "id": 1,
    "username": "updated_username",
    "role": "agent",
    "created_at": "2025-02-08T09:10:15.000Z"
}
```

#### Delete User
```
DELETE /api/users/:id

Response:
{
    "message": "User deleted successfully"
}
```

## Project Structure

```
socket/
├── db/
│   ├── database.js      # Database initialization and connection
│   ├── user.js          # User operations (CRUD, auth)
│   ├── seed.js          # Database seeding script
│   └── queue.db         # SQLite database file
├── middleware/
│   └── auth.js          # Authentication & authorization middleware
├── controller/
│   ├── auth-routes.js   # Authentication routes (login, logout, users)
│   └── routes/
│       └── index.js     # Main application routes
├── views/
│   ├── login.handlebars       # Login page
│   ├── dashboard.handlebars   # User dashboard
│   ├── users.handlebars       # User management page
│   ├── error.handlebars       # Error page
│   └── ... (other views)
└── server.js            # Main server file with session middleware
```

## Session Management

### Session Initialization
Sessions are configured in `server.js` with:
- **Duration**: 24 hours (86400000 milliseconds)
- **Secure**: Cookie is accessible on HTTP (set to `true` for HTTPS in production)
- **Stored**: In-memory (suitable for development; use persistent store for production)

### Environment Variables
```
SESSION_SECRET=your-secret-key-change-in-production
```

Change `SESSION_SECRET` in production for better security.

## Security Features

1. **Password Hashing**: Uses bcrypt with 10 salt rounds
2. **Session Tokens**: Secure session-based authentication
3. **CSRF Protection**: Should be added for POST requests in production
4. **SQL Injection Prevention**: Uses parameterized queries
5. **Account Protection**: Cannot delete own account

## Seeding Database

To create a fresh database with initial admin user:
```bash
rm -f db/queue.db
node db/seed.js
```

## Views Used

1. **login.handlebars**: Clean login interface with error messages
2. **dashboard.handlebars**: User dashboard with quick links and account info
3. **users.handlebars**: CRUD interface for managing users (admin only)
4. **error.handlebars**: Error page for unauthorized access

## Password Requirements

- **Minimum length**: 6 characters (enforced on client and server)
- **Character requirements**: No special requirements (customizable in code)
- **Hashing**: bcrypt with 10 salt rounds

## Customization

### Change Roles
Edit the database constraint in `db/database.js`:
```javascript
role TEXT NOT NULL CHECK(role IN ('admin', 'agent'))
```

### Modify Session Duration
Edit in `server.js`:
```javascript
cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // Change this value
```

### Update Password Requirements
Edit validation in `controller/auth-routes.js` and `views/dashboard.handlebars`

## Troubleshooting

### "Port 8080 is already in use"
```bash
pkill -f "node server.js"
npm run dev
```

### Database locked error
```bash
rm -f db/queue.db
node db/seed.js
npm run dev
```

### Session not persisting
- Ensure cookies are enabled in browser
- Check browser console for errors
- Verify `express-session` is properly initialized

## Production Considerations

1. **Use HTTPS**: Set `secure: true` on cookies
2. **Use persistent session store**: Replace default memory store with connect-mongo, connect-redis, etc.
3. **Use environment variables**: Store SESSION_SECRET in .env file
4. **Rate limiting**: Add rate limiter to login endpoint
5. **CSRF protection**: Add CSRF middleware
6. **Input validation**: Add comprehensive input validation
7. **Logging**: Add logging for security events
8. **Password policy**: Enforce stronger password requirements

## Testing

### Login with Admin
- Username: `admin`
- Password: `admin123`

### Create New User (Admin)
1. Go to Dashboard → Manage Users
2. Click "Add New User"
3. Enter username, password, and select role
4. Click "Create User"

### Change Password
1. Go to Dashboard
2. Click "Change Password"
3. Enter current password and new password
4. Click "Change Password"

## Support

For issues or questions:
1. Check the browser console for errors
2. Check terminal/server logs
3. Verify database file exists at `db/queue.db`
4. Ensure all dependencies are installed: `npm install`
