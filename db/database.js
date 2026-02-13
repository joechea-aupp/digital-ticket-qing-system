const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open the database
const dbPath = path.join(__dirname, 'queue.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database with tables
function initDatabase() {
    db.serialize(() => {
        // Create users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'agent')),
                notification_sound TEXT DEFAULT 'happy-bell.wav',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('Users table initialized');
                // Add notification_sound column if it doesn't exist (migration)
                db.run(`
                    ALTER TABLE users ADD COLUMN notification_sound TEXT DEFAULT 'happy-bell.wav'
                `, (alterErr) => {
                    if (alterErr && !alterErr.message.includes('duplicate column')) {
                        console.error('Error adding notification_sound column:', alterErr);
                    } else if (!alterErr) {
                        console.log('Added notification_sound column to users table');
                    }
                });
            }
        });

        // Check if topics table needs migration (UNIQUE constraint on prefix_id)
        db.all("PRAGMA table_info(topics)", (err, rows) => {
            if (err) {
                console.error('Error checking topics table:', err);
                return;
            }

            if (!rows || rows.length === 0) {
                // Table doesn't exist, create it
                db.run(`
                    CREATE TABLE topics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE NOT NULL,
                        prefix_id TEXT UNIQUE NOT NULL,
                        description TEXT,
                        is_default INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating topics table:', err);
                    } else {
                        console.log('Topics table initialized');
                    }
                });
            } else {
                // Table exists, check if prefix_id has UNIQUE constraint by examining the table info
                const hasPrefixIdColumn = rows.some(col => col.name === 'prefix_id');
                
                if (hasPrefixIdColumn) {
                    // Check if prefix_id already has a UNIQUE constraint by looking at CREATE TABLE statement
                    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='topics'", (err, result) => {
                        if (err) {
                            console.error('Error checking topics table SQL:', err);
                            return;
                        }

                        const tableSQL = result?.sql || '';
                        const hasUniqueConstraint = tableSQL.includes('prefix_id') && 
                                                    (tableSQL.includes('prefix_id TEXT UNIQUE') || 
                                                     tableSQL.match(/prefix_id.*UNIQUE|UNIQUE.*prefix_id/i));

                        if (!hasUniqueConstraint) {
                            console.log('Migrating topics table to add UNIQUE constraint on prefix_id...');
                        // Migration: recreate table with UNIQUE constraint
                        db.serialize(() => {
                            db.run(`
                                CREATE TABLE topics_new (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    name TEXT UNIQUE NOT NULL,
                                    prefix_id TEXT UNIQUE NOT NULL,
                                    description TEXT,
                                    is_default INTEGER DEFAULT 0,
                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                )
                            `, (err) => {
                                if (err) {
                                    console.error('Error creating new topics table:', err);
                                    return;
                                }

                                // Copy data, keeping only first occurrence of duplicate prefix_ids
                                db.run(`
                                    INSERT INTO topics_new 
                                    SELECT id, name, prefix_id, description, is_default, created_at FROM topics
                                    WHERE id IN (
                                        SELECT MIN(id) FROM topics GROUP BY prefix_id
                                    )
                                `, (err) => {
                                    if (err) {
                                        console.error('Error copying topics data:', err);
                                        return;
                                    }

                                    db.run(`DROP TABLE topics`, (err) => {
                                        if (err) {
                                            console.error('Error dropping old topics table:', err);
                                            return;
                                        }

                                        db.run(`ALTER TABLE topics_new RENAME TO topics`, (err) => {
                                            if (err) {
                                                console.error('Error renaming topics table:', err);
                                            } else {
                                                console.log('✓ Topics table migrated successfully with UNIQUE prefix_id constraint');
                                            }
                                        });
                                    });
                                });
                            });
                        });
                        } else {
                            console.log('All table is good to go');
                        }
                    });
                }
            }
        });

        // Create agents table for persistent counters
        db.run(`
            CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                topic_id INTEGER,
                topic_name TEXT,
                is_paused INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating agents table:', err);
            } else {
                console.log('Agents table initialized');
            }
        });
    });
}

// Promisify database methods
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = {
    db,
    dbRun,
    dbGet,
    dbAll
};
