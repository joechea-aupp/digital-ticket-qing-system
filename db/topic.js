const { dbRun, dbGet, dbAll } = require('./database');

// Create new topic
async function createTopic(name, prefix_id, description = '', is_default = false, auto_use_device_name = false) {
    try {
        const result = await dbRun(
            'INSERT INTO topics (name, prefix_id, description, is_default, auto_use_device_name) VALUES (?, ?, ?, ?, ?)',
            [name, prefix_id, description, is_default ? 1 : 0, auto_use_device_name ? 1 : 0]
        );
        return { id: result.lastID, name, prefix_id, description, is_default, auto_use_device_name };
    } catch (error) {
        throw error;
    }
}

// Get topic by ID
async function getTopicById(id) {
    try {
        const topic = await dbGet('SELECT id, name, prefix_id, description, is_default, auto_use_device_name FROM topics WHERE id = ?', [id]);
        if (topic) {
            topic.is_default = !!topic.is_default; // Convert to boolean
            topic.auto_use_device_name = !!topic.auto_use_device_name; // Convert to boolean
        }
        return topic;
    } catch (error) {
        throw error;
    }
}

// Get all topics
async function getAllTopics() {
    try {
        const topics = await dbAll('SELECT id, name, prefix_id, description, is_default, auto_use_device_name FROM topics ORDER BY id ASC');
        return topics.map(t => ({
            ...t,
            is_default: !!t.is_default, // Convert to boolean
            auto_use_device_name: !!t.auto_use_device_name // Convert to boolean
        }));
    } catch (error) {
        throw error;
    }
}

// Get default topic
async function getDefaultTopic() {
    try {
        const topic = await dbGet('SELECT id, name, prefix_id, description, is_default, auto_use_device_name FROM topics WHERE is_default = 1 LIMIT 1');
        if (topic) {
            topic.is_default = !!topic.is_default;
            topic.auto_use_device_name = !!topic.auto_use_device_name;
        }
        return topic;
    } catch (error) {
        throw error;
    }
}

// Update topic
async function updateTopic(id, name, prefix_id, description, is_default, auto_use_device_name) {
    try {
        await dbRun(
            'UPDATE topics SET name = ?, prefix_id = ?, description = ?, is_default = ?, auto_use_device_name = ? WHERE id = ?',
            [name, prefix_id, description, is_default ? 1 : 0, auto_use_device_name ? 1 : 0, id]
        );
        return await getTopicById(id);
    } catch (error) {
        throw error;
    }
}

// Delete topic
async function deleteTopic(id) {
    try {
        // Check if it's the default topic
        const topic = await getTopicById(id);
        if (topic && topic.is_default) {
            throw new Error('Cannot delete the default topic');
        }
        
        await dbRun('DELETE FROM topics WHERE id = ?', [id]);
        return true;
    } catch (error) {
        throw error;
    }
}

// Set default topic
async function setDefaultTopic(id) {
    try {
        // Reset all to non-default
        await dbRun('UPDATE topics SET is_default = 0');
        // Set the new default
        await dbRun('UPDATE topics SET is_default = 1 WHERE id = ?', [id]);
        return await getTopicById(id);
    } catch (error) {
        throw error;
    }
}

// Get topic by prefix
async function getTopicByPrefix(prefix) {
    try {
        const topic = await dbGet('SELECT id, name, prefix_id, description, is_default, auto_use_device_name FROM topics WHERE prefix_id = ?', [prefix.toUpperCase()]);
        if (topic) {
            topic.is_default = !!topic.is_default; // Convert to boolean
            topic.auto_use_device_name = !!topic.auto_use_device_name; // Convert to boolean
        }
        return topic;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    createTopic,
    getTopicById,
    getAllTopics,
    getDefaultTopic,
    updateTopic,
    deleteTopic,
    setDefaultTopic,
    getTopicByPrefix
};
