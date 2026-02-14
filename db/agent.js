const { dbRun, dbAll, dbGet } = require('./database');

// Create new agent/counter
async function createAgent(name, topicId = null, topicName = null, isPaused = false) {
    const result = await dbRun(
        'INSERT INTO agents (name, topic_id, topic_name, is_paused) VALUES (?, ?, ?, ?)',
        [name, topicId, topicName, isPaused ? 1 : 0]
    );
    return getAgentById(result.lastID);
}

// Get agent by ID
async function getAgentById(id) {
    const agent = await dbGet(
        'SELECT id, name, topic_id, topic_name, is_paused, created_at FROM agents WHERE id = ?',
        [id]
    );
    if (!agent) return null;
    return {
        id: agent.id,
        name: agent.name,
        topicId: agent.topic_id,
        topicName: agent.topic_name,
        isPaused: !!agent.is_paused,
        created_at: agent.created_at
    };
}

// Get all agents
async function getAllAgents() {
    const rows = await dbAll(
        'SELECT id, name, topic_id, topic_name, is_paused, created_at FROM agents ORDER BY id ASC'
    );
    return rows.map(agent => ({
        id: agent.id,
        name: agent.name,
        topicId: agent.topic_id,
        topicName: agent.topic_name,
        isPaused: !!agent.is_paused,
        created_at: agent.created_at
    }));
}

// Update agent pause status
async function updateAgentPause(id, isPaused) {
    await dbRun('UPDATE agents SET is_paused = ? WHERE id = ?', [isPaused ? 1 : 0, id]);
    return getAgentById(id);
}

// Update agent topic assignment
async function updateAgentTopic(id, topicId = null, topicName = null) {
    await dbRun('UPDATE agents SET topic_id = ?, topic_name = ? WHERE id = ?', [topicId, topicName, id]);
    return getAgentById(id);
}

// Delete agent
async function deleteAgent(id) {
    await dbRun('DELETE FROM agents WHERE id = ?', [id]);
    return true;
}

module.exports = {
    createAgent,
    getAgentById,
    getAllAgents,
    updateAgentPause,
    updateAgentTopic,
    deleteAgent
};
