/**
 * Seed script to create initial admin user and default topics
 * Run: node db/seed.js
 */

const { createUser, getUserByUsername } = require('./user');
const { createTopic, getAllTopics } = require('./topic');
const { db } = require('./database');

async function seedDatabase() {
    try {
        // Check if admin user already exists
        const existingAdmin = await getUserByUsername('admin');
        if (!existingAdmin) {
            // Create default admin user
            const admin = await createUser('admin', 'admin123', 'admin');
            console.log('✓ Admin user created successfully');
            console.log(`  Username: admin`);
            console.log(`  Password: admin123`);
            console.log(`  Role: admin`);
            console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
        } else {
            console.log('✓ Admin user already exists');
        }

        // Check if default topics exist
        const topics = await getAllTopics();
        if (topics.length === 0) {
            // Create default topics
            const defaultTopics = [
                { name: 'General Inquiry', prefix_id: 'GEN', description: 'General customer inquiries', is_default: true },
                { name: 'Billing Support', prefix_id: 'BILL', description: 'Billing and payment related issues', is_default: false },
                { name: 'Technical Support', prefix_id: 'TECH', description: 'Technical issues and support', is_default: false }
            ];

            for (const topic of defaultTopics) {
                await createTopic(topic.name, topic.prefix_id, topic.description, topic.is_default);
            }
            console.log('✓ Default topics created successfully');
            console.log(`  - ${defaultTopics[0].name} (${defaultTopics[0].prefix_id}) [DEFAULT]`);
            console.log(`  - ${defaultTopics[1].name} (${defaultTopics[1].prefix_id})`);
            console.log(`  - ${defaultTopics[2].name} (${defaultTopics[2].prefix_id})`);
        } else {
            console.log(`✓ Topics already exist (${topics.length} found)`);
        }
        
        db.close();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        db.close();
        process.exit(1);
    }
}

// Add a small delay to ensure database is initialized
setTimeout(seedDatabase, 500);
