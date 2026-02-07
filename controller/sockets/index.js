let ticketQueue = [];
let ticketCounter = 1;
let agents = []; // Array of agents/counters: {id, name, currentTicket, previousTicket}
let agentCounter = 1;

const setupSockets = (wss, serverSessionId) => {
    const broadcastToDisplay = () => {
        // Broadcast to display clients (ticket-queue page)
        const displayData = {
            agents: agents,
            queueRemaining: ticketQueue.length
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'display') {
                client.send(JSON.stringify(displayData));
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
        
        const getTicketData = {
            type: 'currentServing',
            currentTicket: currentTicket,
            agents: agents,
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
    };

    // Display screen WebSocket (ticket-queue page)
    wss.on("show-ticket-queue", (ws, req) => {
        console.log("New connection on /ws/ticket-queue");
        ws.clientType = 'display';
        
        // Send initial state
        ws.send(JSON.stringify({
            agents: agents,
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
        
        ws.send(JSON.stringify({
            type: 'currentServing',
            currentTicket: currentTicket,
            agents: agents,
            queueRemaining: ticketQueue.length,
            serverSessionId: serverSessionId
        }));

        ws.on("message", (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`Received message on /ws/get-ticket:`, data);
                
                if (data.action === 'getTicket' && data.name) {
                    // Create new ticket
                    const newTicket = {
                        id: ticketCounter++,
                        name: data.name,
                        time: new Date().toISOString()
                    };
                    ticketQueue.push(newTicket);
                    
                    // Send confirmation to this client with server session ID
                    ws.send(JSON.stringify({
                        success: true,
                        ticket: newTicket,
                        position: ticketQueue.length,
                        serverSessionId: serverSessionId
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
                        currentTicket: null,
                        previousTicket: null
                    };
                    agents.push(newAgent);
                    broadcastAll();
                    ws.send(JSON.stringify({ 
                        success: true, 
                        message: 'Agent added successfully',
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
                        agent.previousTicket = agent.currentTicket;
                        agent.currentTicket = ticketQueue.shift();
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
                    
                    agent.previousTicket = agent.currentTicket;
                    agent.currentTicket = null;
                    broadcastAll();
                }
            } catch (e) {
                console.error('Error processing admin message:', e);
                ws.send(JSON.stringify({ success: false, error: 'Invalid request' }));
            }
        });
    });
}

module.exports = setupSockets
