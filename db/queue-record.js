const { dbRun, dbGet, dbAll } = require('./database');

/**
 * Create a new queue record for a completed ticket
 * @param {Object} ticket - The ticket object
 * @param {Number} agentId - ID of the agent who served the ticket
 * @param {String} agentName - Name of the agent
 * @param {Date} servedAt - When the ticket was served
 * @param {Number} waitTime - How long the customer waited (in seconds)
 * @returns {Promise<Object>} - The created record
 */
async function createQueueRecord(ticket, agentId, agentName, servedAt, waitTime) {
    try {
        const result = await dbRun(`
            INSERT INTO queue_records (
                ticket_display_id,
                ticket_numeric_id,
                ticket_name,
                topic_id,
                topic_name,
                agent_id,
                agent_name,
                served_at,
                wait_time_seconds,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            ticket.displayId,
            ticket.numericId,
            ticket.name,
            ticket.topicId || null,
            ticket.topicName || null,
            agentId,
            agentName,
            servedAt,
            waitTime
        ]);
        
        return {
            id: result.lastID,
            ticket_display_id: ticket.displayId,
            ticket_numeric_id: ticket.numericId,
            ticket_name: ticket.name,
            topic_id: ticket.topicId || null,
            topic_name: ticket.topicName || null,
            agent_id: agentId,
            agent_name: agentName,
            served_at: servedAt,
            wait_time_seconds: waitTime,
            created_at: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error creating queue record:', error);
        throw error;
    }
}

/**
 * Get all queue records with optional filtering
 * @param {Object} filters - Optional filters { topicId, agentId, startDate, endDate }
 * @param {Object} pagination - { limit, offset }
 * @returns {Promise<Array>} - Array of queue records
 */
async function getAllQueueRecords(filters = {}, pagination = {}) {
    try {
        let query = `SELECT * FROM queue_records WHERE 1=1`;
        const params = [];

        if (filters.topicId) {
            query += ` AND topic_id = ?`;
            params.push(filters.topicId);
        }

        if (filters.agentId) {
            query += ` AND agent_id = ?`;
            params.push(filters.agentId);
        }

        if (filters.startDate) {
            query += ` AND DATE(created_at) >= DATE(?)`;
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND DATE(created_at) <= DATE(?)`;
            params.push(filters.endDate);
        }

        query += ` ORDER BY created_at DESC`;

        const { limit = 100, offset = 0 } = pagination;
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const records = await dbAll(query, params);
        return records || [];
    } catch (error) {
        console.error('Error fetching queue records:', error);
        throw error;
    }
}

/**
 * Get total count of records with optional filters
 * @param {Object} filters - Optional filters
 * @returns {Promise<Number>} - Total count
 */
async function getQueueRecordsCount(filters = {}) {
    try {
        let query = `SELECT COUNT(*) as total FROM queue_records WHERE 1=1`;
        const params = [];

        if (filters.topicId) {
            query += ` AND topic_id = ?`;
            params.push(filters.topicId);
        }

        if (filters.agentId) {
            query += ` AND agent_id = ?`;
            params.push(filters.agentId);
        }

        if (filters.startDate) {
            query += ` AND DATE(created_at) >= DATE(?)`;
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND DATE(created_at) <= DATE(?)`;
            params.push(filters.endDate);
        }

        const result = await dbGet(query, params);
        return result?.total || 0;
    } catch (error) {
        console.error('Error counting queue records:', error);
        throw error;
    }
}

/**
 * Get statistics for queue records
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} - Statistics object
 */
async function getQueueStatistics(filters = {}) {
    try {
        let query = `
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(DISTINCT agent_id) as total_agents,
                COUNT(DISTINCT topic_id) as total_topics,
                AVG(wait_time_seconds) as avg_wait_time,
                MIN(wait_time_seconds) as min_wait_time,
                MAX(wait_time_seconds) as max_wait_time,
                MIN(created_at) as first_record_time,
                MAX(created_at) as last_record_time
            FROM queue_records
            WHERE 1=1
        `;
        const params = [];

        if (filters.topicId) {
            query += ` AND topic_id = ?`;
            params.push(filters.topicId);
        }

        if (filters.agentId) {
            query += ` AND agent_id = ?`;
            params.push(filters.agentId);
        }

        if (filters.startDate) {
            query += ` AND DATE(created_at) >= DATE(?)`;
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND DATE(created_at) <= DATE(?)`;
            params.push(filters.endDate);
        }

        const stats = await dbGet(query, params);
        return stats || {};
    } catch (error) {
        console.error('Error fetching queue statistics:', error);
        throw error;
    }
}

/**
 * Get records grouped by topic
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Records grouped by topic
 */
async function getRecordsByTopic(filters = {}) {
    try {
        let query = `
            SELECT 
                topic_id,
                topic_name,
                COUNT(*) as service_count,
                AVG(wait_time_seconds) as avg_wait_time,
                MIN(wait_time_seconds) as min_wait_time,
                MAX(wait_time_seconds) as max_wait_time
            FROM queue_records
            WHERE 1=1
        `;
        const params = [];

        if (filters.startDate) {
            query += ` AND DATE(created_at) >= DATE(?)`;
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND DATE(created_at) <= DATE(?)`;
            params.push(filters.endDate);
        }

        query += ` GROUP BY topic_id ORDER BY service_count DESC`;

        const records = await dbAll(query, params);
        return records || [];
    } catch (error) {
        console.error('Error fetching records by topic:', error);
        throw error;
    }
}

/**
 * Get records grouped by agent
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Records grouped by agent
 */
async function getRecordsByAgent(filters = {}) {
    try {
        let query = `
            SELECT 
                agent_id,
                agent_name,
                COUNT(*) as service_count,
                AVG(wait_time_seconds) as avg_wait_time,
                MIN(wait_time_seconds) as min_wait_time,
                MAX(wait_time_seconds) as max_wait_time
            FROM queue_records
            WHERE 1=1
        `;
        const params = [];

        if (filters.topicId) {
            query += ` AND topic_id = ?`;
            params.push(filters.topicId);
        }

        if (filters.startDate) {
            query += ` AND DATE(created_at) >= DATE(?)`;
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            query += ` AND DATE(created_at) <= DATE(?)`;
            params.push(filters.endDate);
        }

        query += ` GROUP BY agent_id ORDER BY service_count DESC`;

        const records = await dbAll(query, params);
        return records || [];
    } catch (error) {
        console.error('Error fetching records by agent:', error);
        throw error;
    }
}

/**
 * Delete records older than specified days
 * @param {Number} days - Delete records older than this many days
 * @returns {Promise<Object>} - Result with number of deleted records
 */
async function deleteOldRecords(days = 90) {
    try {
        const result = await dbRun(`
            DELETE FROM queue_records 
            WHERE DATE(created_at) < DATE('now', '-' || ? || ' days')
        `, [days]);
        
        return {
            deleted: result.changes || 0
        };
    } catch (error) {
        console.error('Error deleting old records:', error);
        throw error;
    }
}

module.exports = {
    createQueueRecord,
    getAllQueueRecords,
    getQueueRecordsCount,
    getQueueStatistics,
    getRecordsByTopic,
    getRecordsByAgent,
    deleteOldRecords
};
