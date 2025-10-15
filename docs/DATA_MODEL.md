# Agent Drugs Data Model

## Overview

The Agent Drugs MCP server uses Firestore for data persistence. This document clarifies the purpose and relationship between the different collections.

## Collections

### `drugs` (Drug Catalog)
**Purpose**: Master catalog of all available digital drugs

**Schema**:
```typescript
{
  name: string;                  // Unique drug name (e.g., "focus pocus")
  prompt: string;                // Behavior modification prompt
  defaultDurationMinutes: number; // Default duration when taken
}
```

**Usage**: Read-only catalog queried by `list_drugs` tool

---

### `agents` (Agent Registry)
**Purpose**: Store authenticated agents with their bearer tokens

**Schema**:
```typescript
{
  bearerToken: string;           // JWT bearer token for authentication
  userId: string;                // User who owns this agent
  name: string;                  // Agent display name
  createdAt: Timestamp;          // When agent was created
  lastUsedAt: Timestamp;         // Last time agent connected (updated on each request)
}
```

**Usage**:
- Bearer token validation (HTTP server)
- Token expiration check (90 days since creation)
- Activity tracking

---

### `usage_events` (Historical Audit Log)
**Purpose**: Immutable audit trail of all drug usage for analytics and billing

**Schema**:
```typescript
{
  agentId: string;               // Which agent took the drug
  userId: string;                // Which user owns the agent
  drugName: string;              // Which drug was taken
  timestamp: Timestamp;          // When drug was taken
  durationMinutes: number;       // How long the effect lasts
  expiresAt: Timestamp;          // When the effect expires
}
```

**Usage**:
- **Analytics**: Track drug popularity, usage patterns, peak times
- **Billing**: Calculate usage for potential future billing features
- **Audit**: Immutable record of all actions
- **History**: Query past drug usage

**Important**: This is an **append-only** collection - records are never modified or deleted

---

### `active_drugs` (Current State)
**Purpose**: Fast lookup of currently active drugs per agent

**Document ID**: `{userId}_{agentId}` (one document per agent)

**Schema**:
```typescript
{
  userId: string;                // User who owns the agent
  agentId: string;               // Agent identifier
  drugs: Array<{                 // Array of currently active drugs
    name: string;                // Drug name
    prompt: string;              // Behavior prompt
    expiresAt: Timestamp;        // When effect expires
  }>;
  updatedAt: Timestamp;          // Last modification time
}
```

**Usage**:
- **Fast queries**: Single document read to get all active drugs for an agent
- **Automatic cleanup**: Expired drugs are filtered out on read and cleaned up
- **State management**: Represents current effective state

**Important**: This is a **mutable** collection optimized for read performance

---

## Why Two Collections?

### `usage_events` vs `active_drugs`

While these collections store related data, they serve different purposes:

| Aspect | `usage_events` | `active_drugs` |
|--------|---------------|---------------|
| **Purpose** | Historical audit log | Current state |
| **Mutability** | Immutable (append-only) | Mutable (updated frequently) |
| **Scope** | All-time history | Current moment only |
| **Query Pattern** | Analytics/reporting | Real-time lookups |
| **Data Retention** | Forever | Cleaned up automatically |
| **Performance** | Grows indefinitely | Fixed size per agent |

### Alternative Considered: Single Collection

We could query `usage_events` with `where('expiresAt', '>', now())` to get active drugs, but this approach has issues:

**Drawbacks**:
- ❌ Slower queries (must scan all events for that agent)
- ❌ No automatic cleanup of expired entries
- ❌ More expensive reads as usage history grows
- ❌ Harder to implement atomic "replace drug" logic
- ❌ Mixes concerns (audit vs state)

**Current Design Benefits**:
- ✅ O(1) lookups for active drugs (single document read)
- ✅ Automatic cleanup on every read
- ✅ Clear separation: analytics vs runtime state
- ✅ Predictable query costs
- ✅ Atomic drug replacement (filter + append in transaction)

---

## Query Patterns

### Getting Active Drugs
```typescript
// Fast: Single document read
const doc = await db
  .collection('active_drugs')
  .doc(`${userId}_${agentId}`)
  .get();

// Filters out expired drugs automatically in StateManager.getActiveDrugs()
```

### Recording Drug Usage
```typescript
// 1. Add to audit log (immutable)
await db.collection('usage_events').add({
  agentId, userId, drugName, timestamp, durationMinutes, expiresAt
});

// 2. Update current state (mutable)
await db.collection('active_drugs')
  .doc(`${userId}_${agentId}`)
  .update({ drugs: [...filtered, newDrug] });
```

### Analytics Examples
```typescript
// Total drugs taken by user (all time)
const events = await db
  .collection('usage_events')
  .where('userId', '==', userId)
  .count()
  .get();

// Most popular drug this week
const weekAgo = Timestamp.fromDate(new Date(Date.now() - 7*24*60*60*1000));
const events = await db
  .collection('usage_events')
  .where('timestamp', '>=', weekAgo)
  .get();
// Group by drugName and count
```

---

## Indexing Recommendations

For optimal performance, create these Firestore indexes:

```javascript
// usage_events collection
{
  collectionGroup: "usage_events",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "userId", order: "ASCENDING" },
    { fieldPath: "timestamp", order: "DESCENDING" }
  ]
}

{
  collectionGroup: "usage_events",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "drugName", order: "ASCENDING" },
    { fieldPath: "timestamp", order: "DESCENDING" }
  ]
}

{
  collectionGroup: "usage_events",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "expiresAt", order: "ASCENDING" },
    { fieldPath: "timestamp", order: "DESCENDING" }
  ]
}
```

---

## Future Enhancements

### Potential Additions

1. **Drug Stacking Limits**
   - Add `maxConcurrent` field to drugs collection
   - Validate in take_drug before allowing

2. **Usage Quotas**
   - Add `dailyLimit` to users collection
   - Query usage_events for today's count before allowing

3. **Drug Interactions**
   - Add `conflictsWith: string[]` to drugs collection
   - Check active_drugs before taking new drug

4. **Scheduled Expiration Cleanup**
   - Cloud Function triggered daily
   - Cleans up expired drugs from active_drugs collection
   - Currently relies on lazy cleanup on read

---

## Best Practices

1. **Always use StateManager** for active_drugs operations
   - Handles expiration filtering automatically
   - Manages atomic updates correctly

2. **Never delete from usage_events**
   - It's an immutable audit log
   - Use soft deletion if needed (add `deleted: true` field)

3. **Keep active_drugs synchronized**
   - Always update both collections when taking a drug
   - Use transactions if atomicity is critical

4. **Monitor collection growth**
   - usage_events will grow indefinitely
   - Consider archiving old events (>90 days) to cold storage
