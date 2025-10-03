# High Priority Improvements

This issue tracks all **high priority** improvements identified in the code review. These are critical issues that should be addressed first as they have significant impact on security, performance, and reliability.

## Overview

- **Total Issues:** 5
- **Categories:** Security (1), Performance (2), Testing (1), Architecture (1)
- **Impact:** Critical for production readiness and scalability

---

## Issue #1: MongoDB Connection String Security

**Priority:** High  
**Category:** Security  
**Files:** `src/db.ts`, `src/orchestrator.ts` (lines 4, 16)

### Problem
- MongoDB connection strings may contain sensitive credentials
- Default connection string is hardcoded without authentication
- No validation of connection string format

### Recommendation
```typescript
// Add connection string validation
function validateMongoUri(uri: string): void {
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB connection string format');
  }
  // Warn if using default insecure connection
  if (uri === 'mongodb://localhost:27017') {
    console.warn('⚠️  Using default MongoDB connection without authentication');
  }
}
```

### Benefits
- Prevents accidental exposure of credentials
- Validates configuration before runtime errors
- Improves production readiness

---

## Issue #8: Inefficient Relevance Scoring Algorithm

**Priority:** High  
**Category:** Performance  
**Files:** `src/db.ts` (lines 101-138)

### Problem
- Scores each archived item individually with separate DB updates
- O(n) database updates where n is number of archived items
- Creates unnecessary word sets for every comparison
- No batch operations

### Recommendation
```typescript
export async function scoreRelevance(
  conversationId: string,
  currentContext: string,
  llm: string,
): Promise<number> {
  await connect();

  const archivedItems = await collection
    .find({ conversationId, contextType: "archived" })
    .toArray();

  if (archivedItems.length === 0) return 0;

  const currentWords = new Set(currentContext.toLowerCase().split(/\s+/));
  const bulkOps = [];

  for (const item of archivedItems) {
    const itemText = item.memories.join(" ");
    const itemWords = new Set(itemText.toLowerCase().split(/\s+/));

    const intersection = new Set(
      [...currentWords].filter((x) => itemWords.has(x)),
    );
    const union = new Set([...currentWords, ...itemWords]);
    const relevanceScore = intersection.size / union.size;

    // Queue update instead of executing immediately
    bulkOps.push({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { relevanceScore } }
      }
    });
  }

  // Execute all updates in a single batch
  if (bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps);
  }

  return bulkOps.length;
}
```

### Benefits
- 10-100x faster for large datasets
- Reduces database load
- Single network round-trip instead of n

---

## Issue #9: Missing Database Indexes

**Priority:** High  
**Category:** Performance  
**Files:** `src/db.ts`

### Problem
- No indexes defined for frequent queries
- Queries by `conversationId`, `contextType`, `relevanceScore` are unindexed
- O(n) table scans for every query

### Recommendation
```typescript
export async function createIndexes() {
  await connect();
  
  // Compound index for common query patterns
  await collection.createIndex(
    { conversationId: 1, contextType: 1, relevanceScore: -1 },
    { background: true }
  );
  
  // Index for tag searches
  await collection.createIndex(
    { tags: 1, contextType: 1 },
    { background: true }
  );
  
  // Index for timestamp sorting
  await collection.createIndex(
    { timestamp: -1 },
    { background: true }
  );
  
  console.log('✅ Database indexes created');
}

// Call during initialization
export async function connect() {
  if (client && db && collection) return;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DATABASE_NAME);
  collection = db.collection(COLLECTION_NAME);
  
  // Create indexes on first connection
  await createIndexes();
  
  return collection;
}
```

### Benefits
- 100-1000x query performance improvement
- Scales to millions of documents
- Critical for production use

---

## Issue #20: No Unit Tests

**Priority:** High  
**Category:** Testing  
**Files:** N/A

### Problem
- No test files in the repository
- No test framework configured
- No way to verify correctness
- Risky refactoring

### Recommendation

Create a comprehensive test suite:

```bash
npm install --save-dev jest @types/jest ts-jest
```

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
```

**Example test structure:**
```typescript
// src/__tests__/orchestrator.test.ts
import { ConversationOrchestrator } from '../orchestrator';

describe('ConversationOrchestrator', () => {
  let orchestrator: ConversationOrchestrator;

  beforeEach(() => {
    orchestrator = new ConversationOrchestrator(1000);
  });

  describe('addMessage', () => {
    it('should add message to conversation', async () => {
      // Test implementation
    });

    it('should trigger archiving when threshold reached', async () => {
      // Test implementation
    });
  });

  describe('shouldArchive', () => {
    it('should return false when below threshold', async () => {
      // Test implementation
    });

    it('should return true when above threshold', async () => {
      // Test implementation
    });
  });
});
```

### Benefits
- Catches bugs early
- Enables confident refactoring
- Documents expected behavior
- Professional quality

---

## Issue #24: State Management in Memory

**Priority:** High  
**Category:** Architecture  
**Files:** `src/orchestrator.ts` (line 21)

### Problem
- Conversation state stored only in memory
- Lost on server restart
- No persistence across sessions
- Doesn't scale to multiple instances

### Recommendation
```typescript
// Persist state to database
export class ConversationOrchestrator {
  private stateCache: Map<string, ConversationState> = new Map();
  
  async initializeConversation(
    conversationId: string,
    llm: string,
    userId?: string,
  ): Promise<ConversationState> {
    // Try cache first
    if (this.stateCache.has(conversationId)) {
      return this.stateCache.get(conversationId)!;
    }
    
    // Load from database
    const savedState = await this.repository.getConversationState(conversationId);
    
    if (savedState) {
      this.stateCache.set(conversationId, savedState);
      return savedState;
    }
    
    // Create new state
    const state: ConversationState = {
      conversationId,
      currentContext: [],
      archivedContext: [],
      summaries: [],
      totalWordCount: 0,
      maxWordCount: this.maxWordCount,
      llm,
      userId,
    };
    
    await this.repository.saveConversationState(state);
    this.stateCache.set(conversationId, state);
    
    return state;
  }
  
  // Save state after modifications
  private async saveState(state: ConversationState): Promise<void> {
    await this.repository.saveConversationState(state);
    this.stateCache.set(state.conversationId, state);
  }
}
```

### Benefits
- Survives restarts
- Scales horizontally
- Better reliability

---

## Implementation Priority

These issues should be addressed in the following order:

1. **Issue #9 (Database Indexes)** - Most immediate performance impact, easy to implement
2. **Issue #20 (Unit Tests)** - Foundation for safe refactoring of other issues
3. **Issue #8 (Batch Operations)** - Significant performance improvement with moderate effort
4. **Issue #1 (Security)** - Critical for production deployment
5. **Issue #24 (State Persistence)** - Important for reliability and scalability

## Acceptance Criteria

- [ ] Database indexes created and verified with query plans
- [ ] Test framework configured with >70% code coverage
- [ ] Relevance scoring uses batch operations
- [ ] MongoDB URI validation implemented
- [ ] Conversation state persists across restarts

## Estimated Effort

- **Issue #9:** 2-4 hours
- **Issue #20:** 8-16 hours (initial setup + core tests)
- **Issue #8:** 4-6 hours
- **Issue #1:** 2-3 hours
- **Issue #24:** 8-12 hours

**Total:** ~24-41 hours
