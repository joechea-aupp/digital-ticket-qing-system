// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).render('error', { 
            title: 'Access Denied',
            message: 'You do not have permission to access this page. Admin access required.'
        });
    }
}

// Middleware to check if user is agent or admin
function requireAgentOrAdmin(req, res, next) {
    if (req.session && req.session.user && (req.session.user.role === 'agent' || req.session.user.role === 'admin')) {
        next();
    } else {
        res.status(403).render('error', { 
            title: 'Access Denied',
            message: 'You do not have permission to access this page.'
        });
    }
}

module.exports = {
    requireAuth,
    requireAdmin,
    requireAgentOrAdmin
};
