/**
 * Seed script to create initial admin user
 * Run: node db/seed.js
 */

const { createUser, getUserByUsername } = require('./user');
const { db } = require('./database');

async function seedDatabase() {
    try {
        // Check if admin user already exists
        const existingAdmin = await getUserByUsername('admin');
        if (existingAdmin) {
            console.log('Admin user already exists');
            db.close();
            process.exit(0);
        }

        // Create default admin user
        const admin = await createUser('admin', 'admin123', 'admin');
        console.log('✓ Admin user created successfully');
        console.log(`  Username: admin`);
        console.log(`  Password: admin123`);
        console.log(`  Role: admin`);
        console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
        
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
