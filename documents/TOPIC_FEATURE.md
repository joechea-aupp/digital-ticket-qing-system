# Topic Type Feature Documentation

## Overview
A complete topic management system for the digital ticket queuing system. Topics are now stored in SQLite and can be managed via the queue management interface.

## Features Implemented

### 1. Database Schema
- **Table**: `topics`
- **Columns**:
  - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `name` (TEXT UNIQUE NOT NULL)
  - `prefix_id` (TEXT NOT NULL)
  - `description` (TEXT)
  - `is_default` (INTEGER DEFAULT 0)
  - `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)

### 2. Database Module (`db/topic.js`)
CRUD operations for topics:
- `createTopic(name, prefix_id, description, is_default)` - Create new topic
- `getTopicById(id)` - Retrieve topic by ID
- `getAllTopics()` - Get all topics sorted by name
- `getDefaultTopic()` - Get the default topic
- `updateTopic(id, name, prefix_id, description, is_default)` - Update topic
- `deleteTopic(id)` - Delete topic (prevents deletion of default topic)
- `setDefaultTopic(id)` - Set a topic as default

### 3. API Routes (`controller/topics-routes.js`)

#### Public Endpoints
- `GET /api/topics` - Get all topics
- `GET /api/topics/default` - Get default topic
- `GET /api/topics/:id` - Get topic by ID

#### Admin-Only Endpoints
- `POST /api/topics` - Create new topic
- `PUT /api/topics/:id` - Update topic
- `DELETE /api/topics/:id` - Delete topic
- `PUT /api/topics/:id/set-default` - Set as default topic
- `GET /queue-management` - UI page for managing topics

### 4. Queue Management UI (`views/queue-management.handlebars`)
- Modern Tailwind CSS-based interface
- View all topics in a sortable table
- Create, edit, and delete topics
- Set default topic
- Real-time validation and error handling
- Modal form for topic management

### 5. Default Topics
Three default topics are created during database seeding:

| Name | Prefix | Description | Default |
|------|--------|-------------|---------|
| General Inquiry | GEN | General customer inquiries | ✓ Yes |
| Billing Support | BILL | Billing and payment related issues | No |
| Technical Support | TECH | Technical issues and support | No |

## How to Use

### Access Queue Management
1. Login as admin (username: `admin`, password: `admin123`)
2. Navigate to `/queue-management` or use the sidebar navigation
3. View all topics in the table

### Create a New Topic
1. Click "Add New Topic" button
2. Fill in the form:
   - **Topic Name**: Unique name (e.g., "Returns")
   - **Prefix ID**: Short code for ticket numbering (e.g., "RET")
   - **Description**: Optional details about the topic
   - **Default**: Check to make this the default topic
3. Click "Save Topic"

### Edit a Topic
1. Click the "Edit" button on any topic row
2. Modify the fields
3. Click "Save Topic"

### Set as Default
1. Click the "Default" button (star icon) on any topic
2. Confirm the action
3. The topic will be marked as default (only one per system)

### Delete a Topic
1. Click the "Delete" button on any topic
2. Note: Cannot delete the default topic
3. Confirm deletion

## API Examples

### Get all topics
```bash
curl http://localhost:8080/api/topics
```

### Get default topic
```bash
curl http://localhost:8080/api/topics/default
```

### Create a topic (requires admin auth)
```bash
curl -X POST http://localhost:8080/api/topics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Returns",
    "prefix_id": "RET",
    "description": "Product returns and exchanges",
    "is_default": false
  }'
```

### Update a topic (requires admin auth)
```bash
curl -X PUT http://localhost:8080/api/topics/4 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Returns",
    "prefix_id": "RET",
    "description": "Product returns, exchanges, and refunds",
    "is_default": false
  }'
```

### Set as default (requires admin auth)
```bash
curl -X PUT http://localhost:8080/api/topics/4/set-default
```

### Delete a topic (requires admin auth)
```bash
curl -X DELETE http://localhost:8080/api/topics/4
```

## Files Modified/Created

### New Files
- `db/topic.js` - Topic database module
- `controller/topics-routes.js` - Topic API and UI routes
- `views/queue-management.handlebars` - Queue management UI

### Modified Files
- `db/database.js` - Added topics table creation
- `db/seed.js` - Updated to create default topics
- `server.js` - Added topics routes import and middleware

## Security Notes
- All topic management endpoints require admin authentication
- Topic API endpoints are protected by `requireAdmin` middleware
- Default topic cannot be deleted to ensure system stability
- Topic names are enforced as unique in the database

## Future Enhancements
- Ticket count by topic
- Topic usage statistics
- Archive/deactivate topics instead of deletion
- Topic permissions/assignments
- Topic categories or groups
