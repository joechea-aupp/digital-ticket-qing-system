let ticketQueue = [];
let topicCounters = {}; // Track ticket counter per topic {topicId: counter}
let agents = []; // Array of agents/counters: {id, name, currentTicket, previousTicket, isPaused}
let agentCounter = 1;

// Helper function to generate next ticket ID for a topic
function getNextTicketId(topicId, prefix) {
    if (!topicCounters[topicId]) {
        topicCounters[topicId] = 1;
    }
    const counter = topicCounters[topicId]++;
    const paddedCounter = String(counter).padStart(3, '0');
    const displayId = `${prefix}-${paddedCounter}`;
    return { 
        numericId: counter, 
        displayId: displayId, 
        prefix: prefix 
    };
}

// Export state management functions for use by routes
const stateManager = {
    getAgents: () => agents,
    getQueue: () => ticketQueue,
    getTopicCounters: () => ({ ...topicCounters }),
    setTopicCounter: (topicId, val) => { topicCounters[topicId] = val; },
    getAgentCounter: () => agentCounter,
    setAgentCounter: (val) => { agentCounter = val; },
    addTicket: (ticket) => { ticketQueue.push(ticket); },
    getNextTicket: () => ticketQueue.shift(),
    returnTicketToQueue: (ticket) => { ticketQueue.unshift(ticket); },
    clearQueue: () => { ticketQueue = []; },
    clearAgents: () => { agents = []; },
    resetCounters: () => { topicCounters = {}; agentCounter = 1; },
    getAgent: (agentId) => agents.find(a => a.id === agentId),
    findAgentIndex: (agentId) => agents.findIndex(a => a.id === agentId),
    // Broadcast functions will be set by setupSockets
    broadcastAll: null
};

const setupSockets = (wss, serverState) => {
    const broadcastToDisplay = () => {
        // Broadcast to display clients (ticket-queue page)
        const queueSummary = ticketQueue.map(ticket => ({
            id: ticket.id,
            displayId: ticket.displayId,
            name: ticket.name,
            topic: ticket.topic,
            topicId: ticket.topicId,
            topicName: ticket.topicName
        }));
        const displayData = {
            agents: agents,
            queueRemaining: ticketQueue.length,
            queue: queueSummary
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'display') {
                client.send(JSON.stringify(displayData));
            }
        });
    };

    const broadcastToStations = () => {
        const stationsData = {
            type: 'stations',
            stations: agents,
            queueRemaining: ticketQueue.length
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'stations') {
                client.send(JSON.stringify(stationsData));
            }
        });
    };

    const broadcastToGetTicket = () => {
        // Broadcast current serving tickets to get-ticket clients
        // Get the most recent ticket being served from any agent
        let currentTicket = null;
        for (const agent of agents) {
            if (agent.currentTicket) {
                currentTicket = agent.currentTicket;
                break; // Take the first agent's current ticket
            }
        }
        
        // Get all ticket IDs currently being served
        const servedTicketIds = agents
            .filter(agent => agent.currentTicket && agent.currentTicket.displayId)
            .map(agent => agent.currentTicket.displayId);

        // Find the last served ticket ID by comparing numeric IDs within same topic
        let lastServedTicketId = null;
        let lastServedNumericId = null;
        let lastServedTopicId = null;
        
        for (const agent of agents) {
            if (agent.currentTicket && agent.currentTicket.displayId) {
                if (!lastServedTopicId || agent.currentTicket.topicId === lastServedTopicId) {
                    if (!lastServedNumericId || agent.currentTicket.numericId > lastServedNumericId) {
                        lastServedTicketId = agent.currentTicket.displayId;
                        lastServedNumericId = agent.currentTicket.numericId;
                        lastServedTopicId = agent.currentTicket.topicId;
                    }
                }
            }
            if (agent.previousTicket && agent.previousTicket.displayId) {
                if (!lastServedTopicId || agent.previousTicket.topicId === lastServedTopicId) {
                    if (!lastServedNumericId || agent.previousTicket.numericId > lastServedNumericId) {
                        lastServedTicketId = agent.previousTicket.displayId;
                        lastServedNumericId = agent.previousTicket.numericId;
                        lastServedTopicId = agent.previousTicket.topicId;
                    }
                }
            }
        }
    
        const getTicketData = {
            type: 'currentServing',
            currentTicket: currentTicket,
            agents: agents,
            servedTicketIds: servedTicketIds,
            lastServedTicketId: lastServedTicketId,
            queueRemaining: ticketQueue.length
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'get-ticket') {
                client.send(JSON.stringify(getTicketData));
            }
        });
    };

    const broadcastToAdmin = () => {
        // Broadcast full queue and agents to admin clients
        const adminData = {
            agents: agents,
            queue: ticketQueue,
            queueRemaining: ticketQueue.length
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'admin') {
                client.send(JSON.stringify(adminData));
            }
        });
    };

    const broadcastAll = () => {
        broadcastToDisplay();
        broadcastToAdmin();
        broadcastToGetTicket();
        broadcastToStations();
    };

    // Set the broadcast function in stateManager so routes can use it
    stateManager.broadcastAll = broadcastAll;

    // Display screen WebSocket (ticket-queue page)
    wss.on("show-ticket-queue", (ws, req) => {
        console.log("New connection on /ws/ticket-queue");
        ws.clientType = 'display';
        
        // Send initial state
        const queueSummary = ticketQueue.map(ticket => ({
            id: ticket.id,
            displayId: ticket.displayId,
            name: ticket.name,
            topic: ticket.topic,
            topicId: ticket.topicId,
            topicName: ticket.topicName
        }));
        ws.send(JSON.stringify({
            agents: agents,
            queueRemaining: ticketQueue.length,
            queue: queueSummary
        }));
    });

    // Stations list WebSocket (stations page)
    wss.on("stations", (ws, req) => {
        console.log("New connection on /ws/stations");
        ws.clientType = 'stations';

        ws.send(JSON.stringify({
            type: 'stations',
            stations: agents,
            queueRemaining: ticketQueue.length
        }));
    });

    // Get ticket WebSocket (for users to get tickets)
    wss.on("get-ticket", (ws, req) => {
        console.log("New connection on /ws/get-ticket");
        ws.clientType = 'get-ticket';
        
        // Send initial current serving state with server session ID
        // Get the most recent ticket being served from any agent
        let currentTicket = null;
        for (const agent of agents) {
            if (agent.currentTicket) {
                currentTicket = agent.currentTicket;
                break; // Take the first agent's current ticket
            }
        }
        
        const servedTicketIds = agents
            .filter(agent => agent.currentTicket && agent.currentTicket.displayId)
            .map(agent => agent.currentTicket.displayId);

        let lastServedTicketId = null;
        let lastServedNumericId = null;
        let lastServedTopicId = null;
        
        for (const agent of agents) {
            if (agent.currentTicket && agent.currentTicket.displayId) {
                if (!lastServedTopicId || agent.currentTicket.topicId === lastServedTopicId) {
                    if (!lastServedNumericId || agent.currentTicket.numericId > lastServedNumericId) {
                        lastServedTicketId = agent.currentTicket.displayId;
                        lastServedNumericId = agent.currentTicket.numericId;
                        lastServedTopicId = agent.currentTicket.topicId;
                    }
                }
            }
            if (agent.previousTicket && agent.previousTicket.displayId) {
                if (!lastServedTopicId || agent.previousTicket.topicId === lastServedTopicId) {
                    if (!lastServedNumericId || agent.previousTicket.numericId > lastServedNumericId) {
                        lastServedTicketId = agent.previousTicket.displayId;
                        lastServedNumericId = agent.previousTicket.numericId;
                        lastServedTopicId = agent.previousTicket.topicId;
                    }
                }
            }
        }

        ws.send(JSON.stringify({
            type: 'currentServing',
            currentTicket: currentTicket,
            agents: agents,
            servedTicketIds: servedTicketIds,
            lastServedTicketId: lastServedTicketId,
            queueRemaining: ticketQueue.length,
            serverSessionId: serverState.sessionId
        }));

        ws.on("message", (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`Received message on /ws/get-ticket:`, data);
                
                if (data.action === 'getTicket' && data.name) {
                    // Create new ticket with topic-specific ID
                    const topic = data.topic || {};
                    const ticketId = getNextTicketId(topic.id || 0, topic.prefix_id || 'GEN');
                    
                    const newTicket = {
                        numericId: ticketId.numericId,
                        displayId: ticketId.displayId,
                        id: ticketId.displayId, // For backward compatibility in views
                        name: data.name,
                        topic: topic,
                        topicId: topic.id || 0,
                        time: new Date().toISOString()
                    };
                    ticketQueue.push(newTicket);
                    
                    // Send confirmation to this client with server session ID
                    ws.send(JSON.stringify({
                        success: true,
                        ticket: newTicket,
                        position: ticketQueue.length,
                        serverSessionId: serverState.sessionId
                    }));
                    
                    // Broadcast updated queue
                    broadcastAll();
                }
            } catch (e) {
                console.error('Error processing get-ticket message:', e);
                ws.send(JSON.stringify({ success: false, error: 'Invalid request' }));
            }
        });
    });

    // Admin WebSocket (for admin control)
    wss.on("admin", (ws, req) => {
        console.log("New connection on /ws/admin");
        ws.clientType = 'admin';
        
        // Send initial state
        ws.send(JSON.stringify({
            agents: agents,
            queue: ticketQueue,
            queueRemaining: ticketQueue.length
        }));

        ws.on("message", (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`Received message on /ws/admin:`, data);
                
                if (data.action === 'addAgent') {
                    // Add a new agent/counter
                    const newAgent = {
                        id: agentCounter++,
                        name: data.agentName || `Counter ${agentCounter - 1}`,
                        topicId: data.topicId || null,
                        topicName: data.topicName || null,
                        currentTicket: null,
                        previousTicket: null,
                        isPaused: false
                    };
                    agents.push(newAgent);
                    broadcastAll();
                    const successMessage = data.topicId 
                        ? `Agent "${newAgent.name}" added and assigned to topic "${data.topicName || 'Topic ' + data.topicId}"`
                        : `Agent "${newAgent.name}" added`;
                    ws.send(JSON.stringify({ 
                        success: true, 
                        message: successMessage,
                        agent: newAgent 
                    }));
                } else if (data.action === 'removeAgent') {
                    // Remove an agent/counter
                    const agentIndex = agents.findIndex(a => a.id === data.agentId);
                    if (agentIndex !== -1) {
                        // If agent has a current ticket, return it to queue
                        const agent = agents[agentIndex];
                        if (agent.currentTicket) {
                            ticketQueue.unshift(agent.currentTicket);
                        }
                        agents.splice(agentIndex, 1);
                        broadcastAll();
                        ws.send(JSON.stringify({ 
                            success: true, 
                            message: 'Agent removed successfully' 
                        }));
                    } else {
                        ws.send(JSON.stringify({ 
                            success: false, 
                            error: 'Agent not found' 
                        }));
                    }
                } else if (data.action === 'nextTicket') {
                    // Assign next ticket to a specific agent
                    const agentId = data.agentId;
                    const agent = agents.find(a => a.id === agentId);
                    
                    if (!agent) {
                        ws.send(JSON.stringify({ 
                            success: false, 
                            error: 'Agent not found' 
                        }));
                        return;
                    }
                    
                    if (ticketQueue.length > 0) {
                        // Check if agent has a topic assigned
                        if (agent.topicId) {
                            // Find the next ticket with matching topic
                            const ticketIndex = ticketQueue.findIndex(t => t.topicId === agent.topicId);
                            if (ticketIndex === -1) {
                                ws.send(JSON.stringify({ 
                                    success: false, 
                                    error: `No tickets available for topic "${agent.topicName || 'Topic ' + agent.topicId}"` 
                                }));
                                return;
                            }
                            agent.isPaused = false;
                            agent.previousTicket = agent.currentTicket;
                            agent.currentTicket = ticketQueue.splice(ticketIndex, 1)[0];
                        } else {
                            // No topic assigned, get any ticket from queue
                            agent.isPaused = false;
                            agent.previousTicket = agent.currentTicket;
                            agent.currentTicket = ticketQueue.shift();
                        }
                        broadcastAll();
                    } else {
                        ws.send(JSON.stringify({ 
                            success: false, 
                            error: 'No tickets in queue' 
                        }));
                    }
                } else if (data.action === 'clearCurrent') {
                    // Clear current ticket for a specific agent
                    const agentId = data.agentId;
                    const agent = agents.find(a => a.id === agentId);
                    
                    if (!agent) {
                        ws.send(JSON.stringify({ 
                            success: false, 
                            error: 'Agent not found' 
                        }));
                        return;
                    }
                    
                    // Return the current ticket to the queue
                    if (agent.currentTicket) {
                        ticketQueue.unshift(agent.currentTicket);
                    }
                    
                    agent.previousTicket = agent.currentTicket;
                    agent.currentTicket = null;
                    broadcastAll();
                } else if (data.action === 'completeTicket') {
                    // Complete current ticket for a specific agent (removes from queue)
                    const agentId = data.agentId;
                    const agent = agents.find(a => a.id === agentId);
                    
                    if (!agent) {
                        ws.send(JSON.stringify({ 
                            success: false, 
                            error: 'Agent not found' 
                        }));
                        return;
                    }
                    
                    // Mark as previous ticket and clear current (does NOT return to queue)
                    agent.previousTicket = agent.currentTicket;
                    agent.currentTicket = null;
                    broadcastAll();
                } else if (data.action === 'togglePause') {
                    const agentId = data.agentId;
                    const agent = agents.find(a => a.id === agentId);

                    if (!agent) {
                        ws.send(JSON.stringify({
                            success: false,
                            error: 'Agent not found'
                        }));
                        return;
                    }

                    agent.isPaused = Boolean(data.isPaused);
                    broadcastAll();
                    ws.send(JSON.stringify({
                        success: true,
                        message: agent.isPaused ? 'Counter paused' : 'Counter resumed'
                    }));
                }
            } catch (e) {
                console.error('Error processing admin message:', e);
                ws.send(JSON.stringify({ success: false, error: 'Invalid request' }));
            }
        });
    });

    // Function to broadcast server session reset to all get-ticket clients
    const broadcastServerSessionReset = (newSessionId) => {
        const resetData = {
            type: 'serverSessionReset',
            serverSessionId: newSessionId,
            message: 'Server session has been reset. All tickets have been invalidated.'
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'get-ticket') {
                client.send(JSON.stringify(resetData));
            }
        });
    };

    return {
        broadcastAll,
        broadcastServerSessionReset,
        stateManager
    };
}

module.exports = setupSockets
module.exports.stateManager = stateManager
module.exports.getGlobalState = () => ({ agents, ticketQueue, topicCounters, agentCounter })
