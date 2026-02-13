const express = require("express")
const router = express.Router()
const setupSockets = require("../sockets")
const agentDb = require("../../db/agent")
const { requireAuth, requireAdmin, requireAgentOrAdmin } = require("../../middleware/auth")

// Get the global state manager
const getState = () => setupSockets.getGlobalState();
const stateManager = setupSockets.stateManager;

router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

router.get("/", async (req, res) => {
    try {
        const topicModule = require('../../db/topic');
        const defaultTopic = await topicModule.getDefaultTopic();
        res.render("get-ticket", { title: "Get Your Ticket", topic: defaultTopic || null })
    } catch (error) {
        console.error('Error fetching default topic:', error);
        res.render("get-ticket", { title: "Get Your Ticket", topic: null })
    }
})

router.get("/get-ticket/:topicPrefix", async (req, res) => {
    try {
        const topicModule = require('../../db/topic');
        const topic = await topicModule.getTopicByPrefix(req.params.topicPrefix);
        
        if (!topic) {
            return res.status(404).render("error", { 
                title: "Topic Not Found",
                message: `Topic with prefix '${req.params.topicPrefix}' not found`
            });
        }
        
        res.render("get-ticket", { title: "Get Your Ticket", topic: topic })
    } catch (error) {
        console.error('Error fetching topic:', error);
        return res.status(500).render("error", { 
            title: "Error",
            message: "Failed to fetch topic"
        });
    }
})

router.get("/get-ticket", (req, res) => {
    res.redirect("/")
})

router.get("/ticket-queue",requireAgentOrAdmin, (req, res) => {
    res.render("ticket-queue", { 
        title: "Ticket Queue Display",
        notificationSound: req.session.user.notification_sound || 'happy-bell.wav'
    })
})

router.get("/stations", requireAgentOrAdmin, (req, res) => {
    res.render("stations", { 
        title: "Manage Stations",
        isAdmin: req.session.user.role === 'admin'
    })
})

router.get("/admin", requireAdmin, async (req, res) => {
    try {
        const topicModule = require('../../db/topic');
        const topics = await topicModule.getAllTopics();
        res.render("admin", { 
            title: "Admin Panel - Ticket Queue",
            topics: topics,
            isAdmin: req.session.user.role === 'admin'
        })
    } catch (error) {
        console.error('Error fetching topics:', error);
        res.render("admin", { 
            title: "Admin Panel - Ticket Queue",
            topics: [],
            isAdmin: req.session.user.role === 'admin',
        })
    }
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
    
    // Check if there are tickets available for this station
    let hasAvailableTickets = false;
    if (state.ticketQueue.length > 0) {
        if (station.topicId) {
            // Check if there are tickets for this specific topic
            hasAvailableTickets = state.ticketQueue.some(t => t.topicId === station.topicId);
        } else {
            // No topic assigned, can serve any ticket
            hasAvailableTickets = true;
        }
    }
    
    res.json({
        success: true,
        station: station,
        queueRemaining: state.ticketQueue.length,
        hasAvailableTickets: hasAvailableTickets
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
    
    // Check if agent has a topic assigned
    if (agent.topicId) {
        // Find the next ticket with matching topic
        const ticketIndex = state.ticketQueue.findIndex(t => t.topicId === agent.topicId);
        if (ticketIndex === -1) {
            return res.status(400).json({
                success: false,
                error: `No tickets available for topic "${agent.topicName || 'Topic ' + agent.topicId}"`
            });
        }
        agent.isPaused = false;
        agent.previousTicket = agent.currentTicket;
        agent.currentTicket = state.ticketQueue.splice(ticketIndex, 1)[0];
    } else {
        // No topic assigned, get any ticket from queue
        agent.isPaused = false;
        agent.previousTicket = agent.currentTicket;
        agent.currentTicket = state.ticketQueue.shift();
    }
    
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

// Toggle pause for a specific station
router.post("/station/:id/toggle-pause", requireAuth, async (req, res) => {
    const state = getState();
    const stationId = parseInt(req.params.id);
    const agent = state.agents.find(a => a.id === stationId);
    
    if (!agent) {
        return res.status(404).json({
            success: false,
            error: "Station not found"
        });
    }
    
    agent.isPaused = !agent.isPaused;
    try {
        await agentDb.updateAgentPause(agent.id, agent.isPaused);
    } catch (error) {
        console.error('Error updating agent pause status:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update pause status'
        });
    }
    
    // Broadcast to all connected clients
    if (setupSockets.stateManager.broadcastAll) {
        setupSockets.stateManager.broadcastAll();
    }
    
    res.json({
        success: true,
        message: agent.isPaused ? 'Counter paused' : 'Counter resumed',
        station: agent,
        isPaused: agent.isPaused
    });
});

module.exports = router
