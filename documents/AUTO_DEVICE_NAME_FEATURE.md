# Auto-Use Device Name Feature Documentation

## Overview
A new feature that allows each topic to optionally use device names automatically instead of requiring customers to manually enter their names when getting a ticket. This is configurable per topic.

## Feature Implemented

### 1. Database Schema Update
Added new column to `topics` table:
- `auto_use_device_name` (INTEGER DEFAULT 0) - Boolean flag to enable/disable auto device name for each topic

### 2. Database Module Updates (`db/database.js`)
- Updated table creation to include `auto_use_device_name` column
- Added migration logic to add the column to existing databases
- Migration handles both new table creation and existing table updates

### 3. Topic Database Module (`db/topic.js`)
Updated all CRUD operations to handle the new field:
- `createTopic()` - Now accepts `auto_use_device_name` parameter
- `getTopicById()` - Returns `auto_use_device_name` as boolean
- `getAllTopics()` - Includes `auto_use_device_name` in results
- `getDefaultTopic()` - Returns `auto_use_device_name` field
- `updateTopic()` - Updates `auto_use_device_name` field
- `getTopicByPrefix()` - Returns `auto_use_device_name` field

### 4. API Routes Updates (`controller/topics-routes.js`)
- POST `/api/topics` - Accepts `auto_use_device_name` in request body
- PUT `/api/topics/:id` - Updates `auto_use_device_name` field

### 5. Topics Management UI (`views/topic.handlebars`)
Added new toggle option in the topic form:
- Checkbox labeled "Auto-use Device Name"
- Description: "Use device name automatically instead of requiring customer to enter name"
- Appears below the "Set as Default Topic" checkbox
- Value is saved when creating or editing topics

UI updates include:
- Added checkbox input with id `topicAutoUseDeviceName`
- Updated JavaScript to handle the field in `editTopic()` function
- Updated JavaScript to send the field in form submission

### 6. Get Ticket UI (`views/get-ticket.handlebars`)
Conditional behavior based on topic setting:
- If `auto_use_device_name` is enabled:
  - Name input field is hidden
  - Device name is automatically detected and used
- If `auto_use_device_name` is disabled:
  - Name input field is shown
  - Customer must enter their name manually

Device detection logic:
- Detects device type from user agent string
- Returns appropriate names like:
  - "Android Device"
  - "iPhone"
  - "iPad"
  - "Mac"
  - "Windows PC"
  - "Linux PC"
  - "Unknown Device" (fallback)

### 7. JavaScript Updates
**Client-side logic in get-ticket.handlebars:**
- `getDeviceName()` function - Detects device type from user agent
- Conditional hiding of name input based on `autoUseDeviceName` flag
- Updated `getTicket()` function to use device name when enabled
- Updated `showExpiredTicketMessage()` to show appropriate message

## How to Use

### For Administrators:
1. Navigate to the Topics management page
2. Create a new topic or edit an existing one
3. Check the "Auto-use Device Name" option to enable automatic device name detection
4. Save the topic

### For Customers:
1. Visit the ticket page for a topic with auto-use device name enabled
2. The name input field will not be displayed
3. Click "Get Ticket" - the system will automatically use your device name
4. Your ticket will be created with your device name (e.g., "iPhone", "Windows PC")

### For Topics Without Auto-Use:
1. Visit the ticket page
2. Enter your name in the input field
3. Click "Get Ticket"
4. Your ticket will be created with the name you provided

## Benefits
1. **Faster ticket generation** - No need to type name for self-service kiosks or quick queues
2. **Reduced errors** - No typos in customer names
3. **Flexibility** - Can be enabled/disabled per topic based on use case
4. **Device tracking** - Useful for understanding which devices customers use

## Use Cases
- **Self-service kiosks** - Where customers shouldn't need to enter names
- **Quick service counters** - For fast-moving queues
- **Anonymous queues** - Where customer identity isn't required
- **Device-based tracking** - For analytics on device usage

## Database Migration
The feature includes automatic migration:
- New installations will have the field from the start
- Existing databases will automatically get the `auto_use_device_name` column added with default value of 0 (disabled)
- All existing topics will have the feature disabled by default

## Technical Notes
- The field is stored as INTEGER (0 or 1) in SQLite for compatibility
- Converted to boolean in JavaScript for easier handling
- Default value is 0 (false) - feature is opt-in per topic
- Device detection uses navigator.userAgent string on the client side
- No server-side changes needed for ticket creation - the name is simply populated differently
