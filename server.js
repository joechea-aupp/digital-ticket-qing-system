const express = require("express")
const session = require("express-session")
const { createServer } = require("http")
const path = require("path")
const WebSocket = require("ws")
const { engine } = require("express-handlebars")
const { v4: uuidv4 } = require("uuid")
const routes = require("./controller/routes")
const authRoutes = require("./controller/auth-routes")
const topicsRoutes = require("./controller/topics-routes")
const setupSockets = require("./controller/sockets")
const cookieParser = require("cookie-parser")

require('dotenv').config()

const app = express()
const server = createServer(app)
const wss = new WebSocket.Server({ noServer: true })

// Server state object to hold mutable server UUID
const serverState = {
    sessionId: uuidv4()
}
console.log(`Server Session ID: ${serverState.sessionId}`)

// Export server state so it can be accessed/modified by routes
module.exports.serverState = serverState
module.exports.wss = wss

// Set up Handlebars as the view engine
app.engine("handlebars", engine({
    extname: ".hbs",
    defaultLayout: "main",
    partialsDir: [path.join(__dirname, "views", "partials")],
    helpers: {
        formatDate: function(date) {
            if (!date) return '';
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        json: function(obj) {
            return JSON.stringify(obj);
        }
    }
}))
app.set("view engine", "handlebars")
app.set("views", "./views")

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(cookieParser())

const port = process.env.PORT || 8080
// Session middleware
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}
const sessionMiddleware = session(sessionConfig)
app.use(sessionMiddleware)

// Make user and baseUrl available in all templates
app.use((req, res, next) => {
    res.locals.user = req.session && req.session.user ? req.session.user : null;
    // Set baseUrl from .env or fallback to localhost:port
    res.locals.baseUrl = process.env.URL || `http://localhost:${port}`;
    next();
});

// Use auth routes first
app.use(authRoutes)

// Use topic routes
app.use(topicsRoutes)

// Use other routes
app.use(routes)

// Setup WebSocket handlers and capture the socket methods
const socketMethods = setupSockets(wss, serverState)

// Export socket methods so they can be used by routes
module.exports.socketMethods = socketMethods

// Helper functions for WebSocket authentication
const verifyWebSocketSession = (request, callback) => {
    // Use the session middleware to parse the session for the upgrade request
    sessionMiddleware(request, {}, () => {
        callback(request.session);
    });
};

const isAdminUser = (session) => {
    return session && session.user && session.user.role === 'admin';
};

const isAgentOrAdmin = (session) => {
    return session && session.user && (session.user.role === 'admin' || session.user.role === 'agent');
};

// 404 handler - must come after all other routes
app.use((req, res) => {
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

// 500 error handler - must come last
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('500', { 
        title: '500 - Server Error',
        message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message 
    });
});

server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    switch (pathname) {
        case "/ws/ticket-queue":
            // Public display - no auth required
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('show-ticket-queue', ws, request);
            });
            break;
        
        case "/ws/get-ticket":
            // Public ticket generation - no auth required
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('get-ticket', ws, request);
            });
            break;
        
        case "/ws/admin":
            // Admin only - verify authentication
            verifyWebSocketSession(request, (session) => {
                if (isAdminUser(session)) {
                    wss.handleUpgrade(request, socket, head, (ws) => {
                        wss.emit('admin', ws, request);
                    });
                } else {
                    socket.destroy();
                    console.warn(`Unauthorized admin WebSocket connection attempt - user: ${session?.user?.username || 'unknown'}`);
                }
            });
            break;

        case "/ws/stations":
            // Agent or admin only - verify authentication
            verifyWebSocketSession(request, (session) => {
                if (isAgentOrAdmin(session)) {
                    wss.handleUpgrade(request, socket, head, (ws) => {
                        wss.emit('stations', ws, request);
                    });
                } else {
                    socket.destroy();
                    console.warn(`Unauthorized stations WebSocket connection attempt - user: ${session?.user?.username || 'unknown'}`);
                }
            });
            break;
        
        default:
            socket.destroy();
    }
})

server.listen(port, () => {
    console.log(`http://localhost:${port}`)
})