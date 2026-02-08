const express = require("express")
const router = express.Router()
const setupSockets = require("../sockets")
const { requireAuth, requireAdmin, requireAgentOrAdmin } = require("../../middleware/auth")

// Get the global state manager
const getState = () => setupSockets.getGlobalState();
const stateManager = setupSockets.stateManager;

router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

router.get("/", (req, res) => {
    res.render("get-ticket", { title: "Get Your Ticket" })
})

router.get("/get-ticket", (req, res) => {
    res.redirect("/")
})

router.get("/ticket-queue",requireAgentOrAdmin, (req, res) => {
    res.render("ticket-queue", { title: "Ticket Queue Display" })
})

router.get("/stations", requireAgentOrAdmin, (req, res) => {
    res.render("stations", { title: "Manage Stations" })
})

router.get("/admin", requireAdmin, (req, res) => {
    res.render("admin", { title: "Admin Panel - Ticket Queue" })
})

// Station UI route
router.get("/station-view/:id", requireAuth, (req, res) => {
    const state = getState();
    const stationId = parseInt(req.params.id);
    const station = state.agents.find(a => a.id === stationId);
    
    if (!station) {
        return res.status(404).render("station-not-found", { title: "Station Not Found" });
    }
    
    res.render("station", { 
        title: `${station.name} - Station UI`,
        station: station,
        stationId: stationId,
    });
})

// Station endpoints
// Get all stations
router.get("/station", requireAuth, (req, res) => {
    const state = getState();
    res.json({
        success: true,
        stations: state.agents,
        queueRemaining: state.ticketQueue.length
    });
});

// Get specific station details
router.get("/station/:id", requireAuth, (req, res) => {
    const state = getState();
    const stationId = parseInt(req.params.id);
    const station = state.agents.find(a => a.id === stationId);
    
    if (!station) {
        return res.status(404).json({
            success: false,
            error: "Station not found"
        });
    }
    
    res.json({
        success: true,
        station: station,
        queueRemaining: state.ticketQueue.length
    });
});

// Advance to next ticket for a specific station
router.post("/station/:id/next-ticket", requireAuth, (req, res) => {
    const state = getState();
    const stationId = parseInt(req.params.id);
    const agent = state.agents.find(a => a.id === stationId);
    
    if (!agent) {
        return res.status(404).json({
            success: false,
            error: "Station not found"
        });
    }
    
    if (state.ticketQueue.length === 0) {
        return res.status(400).json({
            success: false,
            error: "No tickets in queue"
        });
    }
    
    agent.isPaused = false;
    agent.previousTicket = agent.currentTicket;
    agent.currentTicket = state.ticketQueue.shift();
    
    // Broadcast to all connected clients
    if (setupSockets.stateManager.broadcastAll) {
        setupSockets.stateManager.broadcastAll();
    }
    
    res.json({
        success: true,
        message: "Advanced to next ticket",
        station: agent,
        ticket: agent.currentTicket,
        queueRemaining: state.ticketQueue.length
    });
});

// Clear current ticket for a specific station
router.post("/station/:id/clear-current", requireAuth, (req, res) => {
    const state = getState();
    const stationId = parseInt(req.params.id);
    const agent = state.agents.find(a => a.id === stationId);
    
    if (!agent) {
        return res.status(404).json({
            success: false,
            error: "Station not found"
        });
    }
    
    // Return the current ticket to the queue
    if (agent.currentTicket) {
        state.ticketQueue.unshift(agent.currentTicket);
    }
    
    agent.previousTicket = agent.currentTicket;
    agent.currentTicket = null;
    
    // Broadcast to all connected clients
    if (setupSockets.stateManager.broadcastAll) {
        setupSockets.stateManager.broadcastAll();
    }
    
    res.json({
        success: true,
        message: "Ticket returned to queue",
        station: agent,
        queueRemaining: state.ticketQueue.length
    });
});

module.exports = router
