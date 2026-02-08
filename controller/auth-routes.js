const express = require('express');
const router = express.Router();
const userModule = require('../db/user');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Login GET
router.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/admin');
    }
    res.render('login', { title: 'Login' });
});

// Login POST
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).render('login', {
                title: 'Login',
                error: 'Username and password are required'
            });
        }

        const user = await userModule.authenticateUser(username, password);

        if (!user) {
            return res.status(401).render('login', {
                title: 'Login',
                error: 'Invalid username or password'
            });
        }

        // Create session
        req.session.user = user;
        if(user.role === 'admin') {
            return res.redirect('/admin');
        }
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).render('login', {
            title: 'Login',
            error: 'An error occurred during login'
        });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.redirect('/login');
    });
});

// Dashboard
router.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard', {
        title: 'Dashboard',
        user: req.session.user,
        isAdmin: req.session.user.role === 'admin'
    });
});

// Users management page (admin only)
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const users = await userModule.getAllUsers();
        res.render('users', {
            title: 'Manage Users',
            user: req.session.user,
            users: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to fetch users'
        });
    }
});

// Create user (admin only)
router.post('/api/users', requireAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Username, password, and role are required' });
        }

        if (!['admin', 'agent'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or agent' });
        }

        const newUser = await userModule.createUser(username, password, role);
        res.status(201).json(newUser);
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get user (admin only)
router.get('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const user = await userModule.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user (admin only)
router.put('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const { username, role } = req.body;

        if (!username || !role) {
            return res.status(400).json({ error: 'Username and role are required' });
        }

        if (!['admin', 'agent'].includes(role)) {
            return res.status(400).json({ error: 'Role must be admin or agent' });
        }

        const updatedUser = await userModule.updateUser(req.params.id, username, role);
        res.json(updatedUser);
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (admin only)
router.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        // Prevent deleting the current user
        if (parseInt(req.params.id) === req.session.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await userModule.deleteUser(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Change password
router.post('/api/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        const user = await userModule.getUserByUsername(req.session.user.username);
        const isValid = await userModule.verifyPassword(currentPassword, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        await userModule.updateUserPassword(req.session.user.id, newPassword);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Force expire all tickets by resetting server UUID (admin only)
router.post('/api/force-expire-tickets', requireAdmin, async (req, res) => {
    try {
        // Get server state and socket methods from server module
        const serverModule = require('../server');
        const socketsModule = require('./sockets');
        const { serverState, socketMethods } = serverModule;
        const { stateManager } = socketsModule;
        
        if (!serverState || !socketMethods || !stateManager) {
            return res.status(500).json({ error: 'Server state not available' });
        }

        // Generate new server session ID
        const oldSessionId = serverState.sessionId;
        serverState.sessionId = uuidv4();
        
        console.log(`Server Session ID reset: ${oldSessionId} -> ${serverState.sessionId}`);
        
        // Clear the queue
        stateManager.clearQueue();
        
        // Clear all agents/counters
        stateManager.clearAgents();
        
        // Reset ticket and agent counters to initial values
        stateManager.resetCounters();
        
        // Broadcast the reset to all get-ticket clients
        socketMethods.broadcastServerSessionReset(serverState.sessionId);
        
        // Broadcast the cleared queue to all clients
        if (stateManager.broadcastAll) {
            stateManager.broadcastAll();
        }
        
        res.json({ 
            success: true,
            message: 'All tickets have been force expired and queue cleared',
            newSessionId: serverState.sessionId
        });
    } catch (error) {
        console.error('Error force expiring tickets:', error);
        res.status(500).json({ error: 'Failed to force expire tickets' });
    }
});

module.exports = router;
