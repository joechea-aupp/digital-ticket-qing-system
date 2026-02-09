#!/bin/sh
set -e

FLAG_FILE="/usr/src/app/db/initialized.flag"

if [ ! -f "$FLAG_FILE" ]; then
    echo "Initializing database..."
    # Run your database initialization commands here, e.g., creating tables
    node db/seed.js
    
    # Create the flag file to indicate initialization is done
    touch "$FLAG_FILE"
    echo "toch completed flage created"
else
    echo "Database already initialized. Skipping initialization."
fi

echo "Starting Application..."

exec npm start