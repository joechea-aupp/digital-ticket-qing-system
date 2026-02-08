const bcrypt = require('bcrypt');
const { dbRun, dbGet, dbAll } = require('./database');

const SALT_ROUNDS = 10;

// Hash password
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
async function verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

// Create new user
async function createUser(username, password, role) {
    try {
        const hashedPassword = await hashPassword(password);
        const result = await dbRun(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );
        return { id: result.lastID, username, role };
    } catch (error) {
        throw error;
    }
}

// Get user by username
async function getUserByUsername(username) {
    try {
        return await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    } catch (error) {
        throw error;
    }
}

// Get user by ID
async function getUserById(id) {
    try {
        return await dbGet('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);
    } catch (error) {
        throw error;
    }
}

// Get all users
async function getAllUsers() {
    try {
        return await dbAll('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    } catch (error) {
        throw error;
    }
}

// Update user
async function updateUser(id, username, role) {
    try {
        await dbRun(
            'UPDATE users SET username = ?, role = ? WHERE id = ?',
            [username, role, id]
        );
        return await getUserById(id);
    } catch (error) {
        throw error;
    }
}

// Update user password
async function updateUserPassword(id, newPassword) {
    try {
        const hashedPassword = await hashPassword(newPassword);
        await dbRun(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, id]
        );
        return true;
    } catch (error) {
        throw error;
    }
}

// Delete user
async function deleteUser(id) {
    try {
        await dbRun('DELETE FROM users WHERE id = ?', [id]);
        return true;
    } catch (error) {
        throw error;
    }
}

// Authenticate user
async function authenticateUser(username, password) {
    try {
        const user = await getUserByUsername(username);
        if (!user) {
            return null;
        }
        const isValid = await verifyPassword(password, user.password);
        if (isValid) {
            return {
                id: user.id,
                username: user.username,
                role: user.role
            };
        }
        return null;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    createUser,
    getUserByUsername,
    getUserById,
    getAllUsers,
    updateUser,
    updateUserPassword,
    deleteUser,
    authenticateUser
};
