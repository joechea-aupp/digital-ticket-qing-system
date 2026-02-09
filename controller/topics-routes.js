const express = require('express');
const router = express.Router();
const topicModule = require('../db/topic');
const { requireAdmin } = require('../middleware/auth');

// Get all topics (public endpoint for viewing)
router.get('/api/topics', async (req, res) => {
    try {
        const topics = await topicModule.getAllTopics();
        res.json(topics);
    } catch (error) {
        console.error('Error fetching topics:', error);
        res.status(500).json({ error: 'Failed to fetch topics' });
    }
});

// Get default topic
router.get('/api/topics/default', async (req, res) => {
    try {
        const topic = await topicModule.getDefaultTopic();
        if (!topic) {
            return res.status(404).json({ error: 'No default topic found' });
        }
        res.json(topic);
    } catch (error) {
        console.error('Error fetching default topic:', error);
        res.status(500).json({ error: 'Failed to fetch default topic' });
    }
});

// Get single topic by ID
router.get('/api/topics/:id', async (req, res) => {
    try {
        const topic = await topicModule.getTopicById(req.params.id);
        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }
        res.json(topic);
    } catch (error) {
        console.error('Error fetching topic:', error);
        res.status(500).json({ error: 'Failed to fetch topic' });
    }
});

// Create new topic (admin only)
router.post('/api/topics', requireAdmin, async (req, res) => {
    try {
        const { name, prefix_id, description, is_default } = req.body;

        if (!name || !prefix_id) {
            return res.status(400).json({ error: 'Name and prefix_id are required' });
        }

        const topic = await topicModule.createTopic(name, prefix_id, description || '', is_default || false);
        res.status(201).json(topic);
    } catch (error) {
        console.error('Error creating topic:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('prefix_id')) {
                return res.status(400).json({ error: 'Topic prefix must be unique' });
            }
            return res.status(400).json({ error: 'Topic name must be unique' });
        }
        res.status(500).json({ error: 'Failed to create topic' });
    }
});

// Update topic (admin only)
router.put('/api/topics/:id', requireAdmin, async (req, res) => {
    try {
        const { name, prefix_id, description, is_default } = req.body;

        if (!name || !prefix_id) {
            return res.status(400).json({ error: 'Name and prefix_id are required' });
        }

        const topic = await topicModule.updateTopic(req.params.id, name, prefix_id, description || '', is_default || false);
        res.json(topic);
    } catch (error) {
        console.error('Error updating topic:', error);
        if (error.message.includes('UNIQUE constraint failed')) {
            if (error.message.includes('prefix_id')) {
                return res.status(400).json({ error: 'Topic prefix must be unique' });
            }
            return res.status(400).json({ error: 'Topic name must be unique' });
        }
        res.status(500).json({ error: 'Failed to update topic' });
    }
});

// Delete topic (admin only)
router.delete('/api/topics/:id', requireAdmin, async (req, res) => {
    try {
        await topicModule.deleteTopic(req.params.id);
        res.json({ success: true, message: 'Topic deleted successfully' });
    } catch (error) {
        console.error('Error deleting topic:', error);
        if (error.message.includes('Cannot delete the default topic')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to delete topic' });
    }
});

// Set default topic (admin only)
router.put('/api/topics/:id/set-default', requireAdmin, async (req, res) => {
    try {
        const topic = await topicModule.setDefaultTopic(req.params.id);
        res.json({ success: true, message: 'Default topic updated', topic });
    } catch (error) {
        console.error('Error setting default topic:', error);
        res.status(500).json({ error: 'Failed to set default topic' });
    }
});

// Topics management page (admin only)
router.get('/topic', requireAdmin, async (req, res) => {
    try {
        const topics = await topicModule.getAllTopics();
        res.render('topic', {
            title: 'Topics',
            user: req.session.user,
            topics: topics,
            isAdmin: req.session.user.role === 'admin'
        });
    } catch (error) {
        console.error('Error fetching topics:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to fetch topics'
        });
    }
});

module.exports = router;
