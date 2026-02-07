let ticketQueue = [];
let ticketCounter = 1;
let currentTicket = null;
let previousTicket = null;

const setupSockets = (wss, serverSessionId) => {
    const broadcastToDisplay = () => {
        // Broadcast to display clients (ticket-queue page)
        const displayData = {
            currentTicket: currentTicket,
            nextTicket: ticketQueue.length > 0 ? ticketQueue[0] : null,
            previousTicket: previousTicket,
            queueRemaining: ticketQueue.length
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'display') {
                client.send(JSON.stringify(displayData));
            }
        });
    };

    const broadcastToGetTicket = () => {
        // Broadcast current serving ticket to get-ticket clients
        const getTicketData = {
            type: 'currentServing',
            currentTicket: currentTicket,
            queueRemaining: ticketQueue.length
        };
        wss.clients.forEach(client => {
            if (client.readyState === 1 && client.clientType === 'get-ticket') {
                client.send(JSON.stringify(getTicketData));
            }
        });
    };

    const broadcastToAdmin = () => {
        // Broadcast full queue to admin clients
        const adminData = {
            currentTicket: currentTicket,
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
            currentTicket: currentTicket,
            nextTicket: ticketQueue.length > 0 ? ticketQueue[0] : null,
            previousTicket: previousTicket,
            queueRemaining: ticketQueue.length
        }));
    });

    // Get ticket WebSocket (for users to get tickets)
    wss.on("get-ticket", (ws, req) => {
        console.log("New connection on /ws/get-ticket");
        ws.clientType = 'get-ticket';
        
        // Send initial current serving state with server session ID
        ws.send(JSON.stringify({
            type: 'currentServing',
            currentTicket: currentTicket,
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
            currentTicket: currentTicket,
            queue: ticketQueue,
            queueRemaining: ticketQueue.length
        }));

        ws.on("message", (message) => {
            try {
                const data = JSON.parse(message);
                console.log(`Received message on /ws/admin:`, data);
                
                if (data.action === 'nextTicket') {
                    // Move to next ticket
                    if (ticketQueue.length > 0) {
                        previousTicket = currentTicket;
                        currentTicket = ticketQueue.shift();
                        broadcastAll();
                    } else {
                        ws.send(JSON.stringify({ 
                            success: false, 
                            error: 'No tickets in queue' 
                        }));
                    }
                } else if (data.action === 'clearCurrent') {
                    // Clear current ticket
                    previousTicket = currentTicket;
                    currentTicket = null;
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
