const express = require("express")
const session = require("express-session")
const { createServer } = require("http")
const path = require("path")
const WebSocket = require("ws")
const { engine } = require("express-handlebars")
const { v4: uuidv4 } = require("uuid")
const routes = require("./controller/routes")
const authRoutes = require("./controller/auth-routes")
const setupSockets = require("./controller/sockets")

const app = express()
const server = createServer(app)
const wss = new WebSocket.Server({ noServer: true })

// Generate unique session UUID for this server instance
const serverSessionId = uuidv4()
console.log(`Server Session ID: ${serverSessionId}`)

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
        }
    }
}))
app.set("view engine", "handlebars")
app.set("views", "./views")

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}))

// Make user available in all templates
app.use((req, res, next) => {
    res.locals.user = req.session && req.session.user ? req.session.user : null;
    next();
});

// Use auth routes first
app.use(authRoutes)

// Use other routes
app.use(routes)

// Setup WebSocket handlers
setupSockets(wss, serverSessionId)

server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    switch (pathname) {
        case "/ws/ticket-queue":
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('show-ticket-queue', ws, request);
            });
            break;
        
        case "/ws/get-ticket":
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('get-ticket', ws, request);
            });
            break;
        
        case "/ws/admin":
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('admin', ws, request);
            });
            break;

        case "/ws/stations":
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('stations', ws, request);
            });
            break;
        
        default:
            socket.destroy();
    }
})

server.listen(8080, () => {
    console.log("http://localhost:8080")
})