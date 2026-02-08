# Topic-Specific Ticket ID Implementation

## Overview
Each topic now maintains its own independent ticket counter, and tickets are displayed with a prefix-ID format (e.g., `GEN-001`, `SERVICE-002`).

## Changes Made

### 1. Socket State Management (`controller/sockets/index.js`)

**Key Changes:**
- Replaced global `ticketCounter` with `topicCounters` object to track per-topic counters
- Added `getNextTicketId(topicId, prefix)` function that generates formatted ticket IDs

**New Ticket ID Format:**
- Format: `PREFIX-###` (e.g., `GEN-001`, `SERVICE-015`)
- Counter is zero-padded to 3 digits
- Each topic maintains its own counter starting from 1
- When ticket ID 999 is reached, next ticket would be 1000 (no limit)

**Updated State Manager Functions:**
- `getTopicCounters()` - Returns all topic counters
- `setTopicCounter(topicId, val)` - Set counter for specific topic
- `resetCounters()` - Clears all topic counters (for admin reset)

**Ticket Object Structure:**
```javascript
{
    numericId: 1,              // For numeric comparisons (1, 2, 3...)
    displayId: "GEN-001",      // For display to users
    id: "GEN-001",             // Backward compatibility
    name: "Customer Name",
    topic: { id, name, prefix_id, ... },
    topicId: 1,                // Topic ID for comparison
    time: "2026-02-08T..."
}
```

### 2. WebSocket Ticket Creation (`controller/sockets/index.js`)

**Updated Message Handler:**
When a user requests a ticket via WebSocket:
```javascript
const topic = data.topic || {};
const ticketId = getNextTicketId(topic.id || 0, topic.prefix_id || 'GEN');

const newTicket = {
    numericId: ticketId.numericId,
    displayId: ticketId.displayId,
    id: ticketId.displayId,
    name: data.name,
    topic: topic,
    topicId: topic.id || 0,
    time: new Date().toISOString()
};
```

### 3. Updated Comparison Logic (`views/get-ticket.handlebars`)

**Key Changes:**
- Ticket ordering **within the same topic** uses `numericId` for comparison
- When checking if ticket is served, filter by `topicId` first
- Displays formatted `id` (displayId) to users
- Correctly handles multiple topics with different prefixes

**Comparison Examples:**
- GEN topic: GEN-001, GEN-002, GEN-003... (compared numerically: 1, 2, 3...)
- SERVICE topic: SERVICE-001, SERVICE-002... (counted independently)
- PAYMENT topic: PAYMENT-001, PAYMENT-002... (counted independently)

### 4. View Updates

#### `views/ticket-queue.handlebars`
- Displays ticket as: `GEN-001` (instead of `#1`)
- Shows topic name alongside ticket

#### `views/admin.handlebars`
- Queue list shows: `Ticket GEN-001` (instead of `Ticket #1`)
- Current serving shows: `GEN-001` (instead of `#1`)

#### `views/get-ticket.handlebars`
- Displays ticket number: `GEN-001`
- Shows tickets remaining using `numericId` within same topic
- Correctly handles expired/your turn status

## Usage Examples

### Default Behavior (No Topic Selected)
When a user goes to the root URL `/`, they get tickets with:
- Topic ID: 0
- Prefix: GEN
- Ticket IDs: GEN-001, GEN-002, GEN-003...

### Topic-Specific Tickets
When accessing `/get-ticket/SERVICE`:
- Topic ID: 2 (from database)
- Prefix: SERVICE (from database)
- Ticket IDs: SERVICE-001, SERVICE-002, SERVICE-003...

Multiple topics can run simultaneously without affecting each other's counters.

## API Behavior

### Creating Ticket via WebSocket
```javascript
ws.send(JSON.stringify({
    action: 'getTicket',
    name: 'John Doe',
    topic: { id: 1, prefix_id: 'GEN', name: 'General' }
}));

// Response:
{
    success: true,
    ticket: {
        numericId: 1,
        displayId: "GEN-001",
        id: "GEN-001",
        name: 'John Doe',
        topicId: 1,
        // ...
    },
    position: 1
}
```

### Broadcasting Queue Status
- Displays `GEN-001`, `SERVICE-002` in different formats based on topic
- Comparison logic ensures correct ordering within topics
- Multiple agents can serve different topics simultaneously

## Admin Functions

### Force Expire All Tickets
```bash
POST /api/force-expire-tickets
```
- Clears all ticket counters
- Resets all topic counters to initial state
- Changes server session ID to invalidate existing tickets
- All affected users see "Expired" message

## Features

✅ **Independent Counters** - Each topic has its own ticket numbering
✅ **Clear Prefixes** - Easy to identify which topic a ticket belongs to
✅ **Proper Ordering** - Tickets are correctly ordered within their topic
✅ **Backward Compatible** - Views use standard `ticket.id` property
✅ **Scalable** - Can handle unlimited topics without conflicts
✅ **Storage Friendly** - Tickets persist in queue during server uptime

## Edge Cases Handled

1. **No Topic Specified** - Defaults to topic ID 0 with "GEN" prefix
2. **Multiple Topics Same Time** - Each maintains independent counter
3. **Server Reset** - All counters reset to 1
4. **Cross-Topic Comparison** - Filtered by topicId before numeric comparison
5. **Old Tickets** - Previous tickets with numeric IDs won't break (backward compatible)

## Testing

The implementation was verified with the following test cases:
- ✅ GEN topic generates: GEN-001, GEN-002, GEN-003...
- ✅ SERVICE topic generates: SERVICE-001, SERVICE-002...
- ✅ PAYMENT topic generates: PAYMENT-001, PAYMENT-002...
- ✅ Each topic counter increments independently
- ✅ Zero-padding works correctly (001, 002, ... 099, 100...)
- ✅ Comparison logic filters by topic before ordering
