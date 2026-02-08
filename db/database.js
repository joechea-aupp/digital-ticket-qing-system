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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('Users table initialized');
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
                // Table exists, check if prefix_id has UNIQUE constraint
                db.all("PRAGMA index_list(topics)", (err, indexes) => {
                    if (err) {
                        console.error('Error checking topics indexes:', err);
                        return;
                    }

                    const hasUniquePrefix = indexes.some(idx => 
                        idx.name.includes('prefix_id') && idx.unique
                    );

                    if (!hasUniquePrefix) {
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
                        console.log('Topics table already has UNIQUE constraint on prefix_id');
                    }
                });
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
