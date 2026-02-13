const express = require("express")
const router = express.Router()
const setupSockets = require("../sockets")
const agentDb = require("../../db/agent")
const queueRecordDb = require('../../db/queue-record');
const { requireAuth, requireAdmin, requireAgentOrAdmin } = require("../../middleware/auth")

// Get the global state manager
const getState = () => setupSockets.getGlobalState();
const stateManager = setupSockets.stateManager;

async function saveQueueRecordForTicket(ticket, agent) {
    if (!ticket || !agent) {
        return;
    }

    try {
        const ticketTime = new Date(ticket.time);
        const servedTime = new Date();
        const waitTime = Math.floor((servedTime - ticketTime) / 1000);
        const topicName = ticket.topicName || (ticket.topic && ticket.topic.name) || null;

        const ticketToSave = {
            displayId: ticket.displayId,
            numericId: ticket.numericId,
            name: ticket.name,
            topicId: ticket.topicId,
            topicName: topicName,
            time: ticket.time
        };

        await queueRecordDb.createQueueRecord(
            ticketToSave,
            agent.id,
            agent.name,
            servedTime.toISOString(),
            waitTime
        );
    } catch (err) {
        console.error('Error saving queue record:', err);
    }
}

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
router.post("/station/:id/next-ticket", requireAuth, async (req, res) => {
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
        const previousTicket = agent.currentTicket;
        agent.previousTicket = agent.currentTicket;
        agent.currentTicket = state.ticketQueue.splice(ticketIndex, 1)[0];
        await saveQueueRecordForTicket(previousTicket, agent);
    } else {
        // No topic assigned, get any ticket from queue
        agent.isPaused = false;
        const previousTicket = agent.currentTicket;
        agent.previousTicket = agent.currentTicket;
        agent.currentTicket = state.ticketQueue.shift();
        await saveQueueRecordForTicket(previousTicket, agent);
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

// Complete current ticket (mark as served, without getting next one)
router.post("/station/:id/complete", requireAuth, async (req, res) => {
    try {
        const state = getState();
        const stationId = parseInt(req.params.id);
        
        if (isNaN(stationId)) {
            return res.status(400).json({
                success: false,
                error: "Invalid station ID"
            });
        }
        
        const agent = state.agents.find(a => a.id === stationId);
        
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: "Station not found"
            });
        }
        
        if (!agent.currentTicket) {
            return res.status(400).json({
                success: false,
                error: "No current ticket to complete"
            });
        }

        await saveQueueRecordForTicket(agent.currentTicket, agent);
        
        agent.previousTicket = agent.currentTicket;
        agent.currentTicket = null;
        
        // Broadcast to all connected clients
        if (setupSockets.stateManager && setupSockets.stateManager.broadcastAll) {
            setupSockets.stateManager.broadcastAll();
        }
        
        res.json({
            success: true,
            message: "Ticket marked as completed",
            station: agent,
            queueRemaining: state.ticketQueue.length
        });
    } catch (error) {
        console.error('Error completing ticket:', error);
        res.status(500).json({
            success: false,
            error: "Failed to complete ticket: " + error.message
        });
    }
});

// Queue Report Routes
// Report page
router.get("/report", requireAdmin, async (req, res) => {
    try {
        const topicModule = require('../../db/topic');
        const agentModule = require('../../db/agent');
        
        const topics = await topicModule.getAllTopics();
        const agents = await agentModule.getAllAgents();
        
        res.render("report", { 
            title: "Queue Reports",
            topics: topics || [],
            agents: agents || [],
            isAdmin: true
        });
    } catch (error) {
        console.error('Error loading report page:', error);
        res.render("report", { 
            title: "Queue Reports",
            topics: [],
            agents: [],
            isAdmin: true
        });
    }
});

// API endpoint to get queue records
router.get("/api/queue-records", requireAdmin, async (req, res) => {
    try {
        const filters = {};
        const pagination = {
            limit: parseInt(req.query.limit) || 50,
            offset: ((parseInt(req.query.page) || 1) - 1) * (parseInt(req.query.limit) || 50)
        };

        if (req.query.startDate) filters.startDate = req.query.startDate;
        if (req.query.endDate) filters.endDate = req.query.endDate;
        if (req.query.topicId) filters.topicId = parseInt(req.query.topicId);
        if (req.query.agentId) filters.agentId = parseInt(req.query.agentId);

        const records = await queueRecordDb.getAllQueueRecords(filters, pagination);
        const total = await queueRecordDb.getQueueRecordsCount(filters);
        const statistics = await queueRecordDb.getQueueStatistics(filters);

        res.json({
            success: true,
            records: records,
            total: total,
            statistics: statistics
        });
    } catch (error) {
        console.error('Error fetching queue records:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to get agent performance
router.get("/api/queue-records/performance/agents", requireAdmin, async (req, res) => {
    try {
        const filters = {};

        if (req.query.startDate) filters.startDate = req.query.startDate;
        if (req.query.endDate) filters.endDate = req.query.endDate;
        if (req.query.topicId) filters.topicId = parseInt(req.query.topicId);

        const agents = await queueRecordDb.getRecordsByAgent(filters);

        res.json({
            success: true,
            agents: agents
        });
    } catch (error) {
        console.error('Error fetching agent performance:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to get topic performance
router.get("/api/queue-records/performance/topics", requireAdmin, async (req, res) => {
    try {
        const filters = {};

        if (req.query.startDate) filters.startDate = req.query.startDate;
        if (req.query.endDate) filters.endDate = req.query.endDate;

        const topics = await queueRecordDb.getRecordsByTopic(filters);

        res.json({
            success: true,
            topics: topics
        });
    } catch (error) {
        console.error('Error fetching topic performance:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to download records as CSV
router.get("/api/queue-records/download", requireAdmin, async (req, res) => {
    try {
        const filters = {};

        if (req.query.startDate) filters.startDate = req.query.startDate;
        if (req.query.endDate) filters.endDate = req.query.endDate;
        if (req.query.topicId) filters.topicId = parseInt(req.query.topicId);
        if (req.query.agentId) filters.agentId = parseInt(req.query.agentId);

        // Get all records without pagination
        const records = await queueRecordDb.getAllQueueRecords(filters, { limit: 999999, offset: 0 });

        if (records.length === 0) {
            return res.status(400).json({
                success: false,
                error: "No records to download"
            });
        }

        // Generate CSV
        const csv = generateCSV(records);

        // Set response headers for download
        const timestamp = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="queue-report-${timestamp}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Error downloading records:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to generate CSV
function generateCSV(records) {
    const headers = [
        'Ticket ID',
        'Customer Name',
        'Topic',
        'Agent',
        'Wait Time (seconds)',
        'Served At',
        'Created At'
    ];

    let csv = headers.join(',') + '\n';

    records.forEach(record => {
        csv += [
            `"${record.ticket_display_id}"`,
            `"${record.ticket_name}"`,
            `"${record.topic_name || ''}"`,
            `"${record.agent_name || ''}"`,
            record.wait_time_seconds || 0,
            `"${record.served_at || ''}"`,
            `"${record.created_at || ''}"`
        ].join(',') + '\n';
    });

    return csv;
}

module.exports = router
