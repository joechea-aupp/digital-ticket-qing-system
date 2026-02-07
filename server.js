const express = require("express")
const { createServer } = require("http")
const WebSocket = require("ws")
const { engine } = require("express-handlebars")
const { v4: uuidv4 } = require("uuid")
const routes = require("./controller/routes")
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
    defaultLayout: "main"
}))
app.set("view engine", "handlebars")
app.set("views", "./views")

app.use(express.json())

// Use routes
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
    console.log("Server is listening on port 8080")
})