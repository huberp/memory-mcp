# Medium Priority Improvements

This issue tracks all **medium priority** improvements identified in the code review. These improvements enhance code quality, maintainability, robustness, and developer experience.

## Overview

- **Total Issues:** 16
- **Categories:** Security (2), Error Handling (3), Performance (1), Code Quality (2), Type Safety (2), Documentation (1), Architecture (3), Configuration (2)
- **Impact:** Important for production quality and maintainability

---

## Security & Validation

### Issue #2: No Input Validation for User-Provided Content

**Priority:** Medium  
**Files:** `src/index.ts`, `src/orchestrator.ts`

#### Problem
- User messages, tags, and summaries are not sanitized
- Could lead to NoSQL injection if used in complex queries
- No length limits on user inputs

#### Recommendation
```typescript
// Add input validation utilities
function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (input.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  return input.trim();
}

function validateTags(tags: string[]): void {
  if (tags.length > 50) {
    throw new Error('Too many tags (max 50)');
  }
  tags.forEach(tag => {
    if (tag.length > 100) {
      throw new Error('Tag too long (max 100 characters)');
    }
  });
}
```

#### Benefits
- Prevents potential injection attacks
- Ensures reasonable resource usage
- Better error messages for users

---

### Issue #3: No Database Connection Timeout

**Priority:** Medium  
**Files:** `src/db.ts` (lines 12-19)

#### Problem
- MongoDB client connection has no timeout configuration
- Could hang indefinitely on connection issues
- No retry logic for transient failures

#### Recommendation
```typescript
export async function connect() {
  if (client && db && collection) return;
  
  const options = {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };
  
  client = new MongoClient(MONGODB_URI, options);
  await client.connect();
  db = client.db(DATABASE_NAME);
  collection = db.collection(COLLECTION_NAME);
  return collection;
}
```

#### Benefits
- Prevents indefinite hangs
- Faster failure detection
- Better user experience

---

## Error Handling & Robustness

### Issue #4: Insufficient Error Context in Catch Blocks

**Priority:** Medium  
**Files:** `src/index.ts` (multiple locations)

#### Problem
- Generic error handling loses context
- Stack traces not logged for debugging
- Error messages don't include request context

#### Recommendation
```typescript
// Enhanced error handling
try {
  await connect();
  const memories = await getAllMemories();
  // ... rest of code
} catch (error: any) {
  console.error('Error in get-memories tool:', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  return {
    content: [{
      type: "text",
      text: `Error retrieving memories: ${error.message || "Unknown error"}`,
    }],
  };
}
```

#### Benefits
- Better debugging capabilities
- Easier troubleshooting in production
- More informative logs

---

### Issue #5: Race Condition in Database Connection

**Priority:** Medium  
**Files:** `src/db.ts` (lines 12-19)

#### Problem
- Multiple simultaneous calls to `connect()` could create duplicate connections
- No connection pooling management
- No handling of connection state changes

#### Recommendation
```typescript
let connectionPromise: Promise<Collection<Memory>> | null = null;

export async function connect() {
  if (client && db && collection) return collection;
  
  // Prevent race conditions
  if (connectionPromise) {
    return connectionPromise;
  }
  
  connectionPromise = (async () => {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
    collection = db.collection(COLLECTION_NAME);
    return collection;
  })();
  
  return connectionPromise;
}
```

#### Benefits
- Prevents multiple connection attempts
- More efficient resource usage
- Eliminates race conditions

---

### Issue #7: Missing Error Handling in Orchestrator State Updates

**Priority:** Medium  
**Files:** `src/orchestrator.ts` (lines 141-163, 168-179)

#### Problem
- Database operations in `executeArchive` and `executeRetrieval` can fail
- State modifications happen even if DB operations fail
- No rollback mechanism

#### Recommendation
```typescript
async executeArchive(decision: ArchiveDecision, state: ConversationState): Promise<void> {
  if (!decision.shouldArchive) return;

  // Store original state for rollback
  const originalContext = [...state.currentContext];
  const originalWordCount = state.totalWordCount;

  try {
    // Archive the messages
    const archivedCount = await archiveContext(
      state.conversationId,
      decision.messagesToArchive,
      decision.tags,
      state.llm,
      state.userId,
    );

    // Only update state after successful DB operation
    const archivedWordCount = decision.messagesToArchive.reduce(
      (sum, msg) => sum + this.getWordCount(msg),
      0,
    );

    state.currentContext = state.currentContext.slice(decision.messagesToArchive.length);
    state.totalWordCount -= archivedWordCount;

    console.log(`Archived ${archivedCount} messages for conversation ${state.conversationId}`);
  } catch (error) {
    // Rollback state on failure
    state.currentContext = originalContext;
    state.totalWordCount = originalWordCount;
    throw error;
  }
}
```

#### Benefits
- Maintains data consistency
- Prevents state corruption
- Better error recovery

---

## Performance

### Issue #11: Retrieving Context Loads Entire Documents

**Priority:** Medium  
**Files:** `src/db.ts` (lines 76-99)

#### Problem
- Retrieves all fields even when only some are needed
- No field projection in queries
- Transfers unnecessary data over network

#### Recommendation
```typescript
export async function retrieveContext(
  conversationId: string,
  tags?: string[],
  minRelevanceScore: number = 0.1,
  limit: number = 10,
): Promise<Memory[]> {
  await connect();

  const filter: any = {
    conversationId,
    contextType: "archived",
    relevanceScore: { $gte: minRelevanceScore },
  };

  if (tags && tags.length > 0) {
    filter.tags = { $in: tags };
  }

  // Project only needed fields
  return collection
    .find(filter)
    .project({
      memories: 1,
      timestamp: 1,
      relevanceScore: 1,
      tags: 1,
      wordCount: 1,
      // Exclude large fields if not needed
      summaryText: 0,
    })
    .sort({ relevanceScore: -1, timestamp: -1 })
    .limit(limit)
    .toArray();
}
```

#### Benefits
- Reduces network transfer
- Faster query execution
- Lower memory usage

---

## Code Quality

### Issue #13: Magic Numbers Throughout Code

**Priority:** Medium  
**Files:** `src/orchestrator.ts`, `src/cli.ts` (multiple locations)

#### Problem
- Hard-coded values like 0.3, 0.2, 5, 10, 20, 50, 100 scattered throughout
- Unclear meaning without context
- Difficult to tune parameters

#### Recommendation
```typescript
// Create a configuration object
export class ConversationOrchestrator {
  private static readonly CONFIG = {
    ARCHIVE_THRESHOLD: 0.8,
    RETRIEVE_THRESHOLD: 0.3,
    ARCHIVE_PERCENTAGE: 0.3,
    MIN_RELEVANCE_SCORE: 0.2,
    RETRIEVE_LIMIT: 5,
    SUMMARY_THRESHOLD: 20,
    MAX_TAGS: 50,
    MAX_TAG_LENGTH: 100,
    RECOMMENDATION_HIGH_USAGE: 0.9,
    RECOMMENDATION_MEDIUM_USAGE: 0.7,
    RECOMMENDATION_LOW_USAGE: 0.2,
  };
  
  // Use named constants instead of magic numbers
  private async shouldArchive(state: ConversationState): Promise<ArchiveDecision> {
    const usageRatio = state.totalWordCount / state.maxWordCount;

    if (usageRatio < ConversationOrchestrator.CONFIG.ARCHIVE_THRESHOLD) {
      return { shouldArchive: false, messagesToArchive: [], tags: [], reason: "Below archive threshold" };
    }

    const messagesToArchive = state.currentContext.slice(
      0, 
      Math.floor(state.currentContext.length * ConversationOrchestrator.CONFIG.ARCHIVE_PERCENTAGE)
    );
    // ...
  }
}
```

#### Benefits
- Self-documenting code
- Easy to adjust parameters
- Central configuration location

---

### Issue #15: No Validation of Conversation State

**Priority:** Medium  
**Files:** `src/orchestrator.ts` (lines 215-238)

#### Problem
- `getConversationStatus` throws error if conversation not found
- Other methods silently create conversations
- Inconsistent behavior

#### Recommendation
```typescript
/**
 * Get conversation state safely
 */
private getConversationState(conversationId: string): ConversationState | null {
  return this.conversations.get(conversationId) || null;
}

/**
 * Get conversation state and recommendations
 */
async getConversationStatus(conversationId: string): Promise<{
  state: ConversationState;
  recommendations: string[];
} | null> {
  const state = this.getConversationState(conversationId);
  if (!state) return null; // Return null instead of throwing

  // ... rest of implementation
}
```

#### Benefits
- More predictable API
- Easier error handling
- Consistent behavior

---

## Type Safety

### Issue #17: Any Type Usage in Error Handlers

**Priority:** Medium  
**Files:** `src/index.ts`, `src/cli.ts` (multiple locations)

#### Problem
- `catch (error: any)` loses type safety
- Could use unknown or custom error types
- No type guards for error handling

#### Recommendation
```typescript
// Define custom error types
class MCPToolError extends Error {
  constructor(
    message: string,
    public readonly tool: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'MCPToolError';
  }
}

// Use proper error handling
try {
  await connect();
  const memories = await getAllMemories();
  // ...
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error(`Error in get-memories tool: ${error.message}`);
    return {
      content: [{
        type: "text",
        text: `Error retrieving memories: ${error.message}`,
      }],
    };
  }
  throw error; // Re-throw if not an Error
}
```

#### Benefits
- Better type safety
- More robust error handling
- Easier debugging

---

### Issue #19: Loose Type for Memory Interface

**Priority:** Medium  
**Files:** `src/types.ts` (lines 6-21)

#### Problem
- Most fields are optional
- No validation of required fields
- Could create invalid memory objects

#### Recommendation
```typescript
// Separate types for different contexts
export interface BaseMemory {
  _id?: ObjectId;
  memories: string[];
  timestamp: Date;
  llm: string;
  userId?: string;
}

export interface ConversationMemory extends BaseMemory {
  conversationId: string;
  contextType: ContextType;
  messageIndex?: number;
  wordCount?: number;
}

export interface ArchivedMemory extends ConversationMemory {
  contextType: "archived";
  relevanceScore?: number;
  tags?: string[];
  parentContextId?: ObjectId;
}

export interface SummaryMemory extends ConversationMemory {
  contextType: "summary";
  summaryText: string;
  wordCount: number;
}

export type Memory = BaseMemory | ConversationMemory | ArchivedMemory | SummaryMemory;
```

#### Benefits
- Stronger type checking
- Prevents invalid states
- Better autocomplete

---

## Documentation

### Issue #22: README Missing Important Details

**Priority:** Medium  
**Files:** `README.md`

#### Problem
- No MongoDB setup instructions
- No environment variable documentation
- No troubleshooting section
- No API reference

#### Recommendation

Add sections for:
- MongoDB installation and setup
- Complete environment variables list
- Troubleshooting common issues
- API reference with examples
- Performance considerations
- Production deployment guide

#### Benefits
- Easier onboarding
- Fewer support questions
- Better user experience

---

## Architecture

### Issue #23: Tight Coupling Between Orchestrator and Database

**Priority:** Medium  
**Files:** `src/orchestrator.ts`

#### Problem
- Orchestrator directly imports database functions
- Hard to test without real database
- No dependency injection
- No abstraction layer

#### Recommendation
```typescript
// Define repository interface
interface IMemoryRepository {
  archiveContext(...): Promise<number>;
  retrieveContext(...): Promise<Memory[]>;
  scoreRelevance(...): Promise<number>;
  createSummary(...): Promise<ObjectId>;
  getConversationSummaries(...): Promise<Memory[]>;
}

// Inject dependency
export class ConversationOrchestrator {
  constructor(
    private maxWordCount: number = 8000,
    private repository?: IMemoryRepository
  ) {
    this.repository = repository || createDefaultRepository();
  }
  
  // Use this.repository instead of direct imports
}
```

#### Benefits
- Easier unit testing
- More flexible architecture
- Better separation of concerns

---

### Issue #25: No Observability/Metrics

**Priority:** Medium  
**Files:** All files

#### Problem
- No metrics collection
- No performance monitoring
- Hard to debug production issues
- No insight into usage patterns

#### Recommendation
```typescript
// Add metrics collection
interface Metrics {
  archiveOperations: number;
  retrievalOperations: number;
  averageRelevanceScore: number;
  totalConversations: number;
  averageContextSize: number;
}

class MetricsCollector {
  private metrics: Metrics = {
    archiveOperations: 0,
    retrievalOperations: 0,
    averageRelevanceScore: 0,
    totalConversations: 0,
    averageContextSize: 0,
  };

  recordArchive() {
    this.metrics.archiveOperations++;
  }

  recordRetrieval(relevanceScore: number) {
    this.metrics.retrievalOperations++;
    // Update running average
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }
}
```

#### Benefits
- Better observability
- Easier debugging
- Usage insights
- Performance tracking

---

### Issue #26: No Circuit Breaker for Database

**Priority:** Medium  
**Files:** `src/db.ts`

#### Problem
- Continues trying database operations even when database is down
- Can overwhelm failing database
- No graceful degradation

#### Recommendation
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

#### Benefits
- Prevents cascade failures
- Faster failure detection
- Better resilience

---

## Configuration

### Issue #27: Hard-Coded Configuration

**Priority:** Medium  
**Files:** Multiple files

#### Problem
- Database name and collection hardcoded
- No configuration file support
- CLI demo has hardcoded limits
- Can't customize behavior without code changes

#### Recommendation
```typescript
// config.ts
export interface Config {
  mongodb: {
    uri: string;
    database: string;
    collection: string;
    timeoutMs: number;
  };
  orchestrator: {
    maxWordCount: number;
    archiveThreshold: number;
    retrieveThreshold: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

export function loadConfig(): Config {
  return {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      database: process.env.MONGODB_DATABASE || 'memory_mcp',
      collection: process.env.MONGODB_COLLECTION || 'memories',
      timeoutMs: parseInt(process.env.MONGODB_TIMEOUT || '5000'),
    },
    orchestrator: {
      maxWordCount: parseInt(process.env.MAX_WORD_COUNT || '8000'),
      archiveThreshold: parseFloat(process.env.ARCHIVE_THRESHOLD || '0.8'),
      retrieveThreshold: parseFloat(process.env.RETRIEVE_THRESHOLD || '0.3'),
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
    },
  };
}
```

#### Benefits
- Easy customization
- Environment-specific config
- No code changes needed

---

### Issue #28: No Schema Validation

**Priority:** Medium  
**Files:** `src/types.ts`, `src/db.ts`

#### Problem
- No runtime validation of Memory objects
- Could insert invalid data
- No schema versioning

#### Recommendation
```typescript
import { z } from 'zod';

// Define Zod schemas
const MemorySchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  memories: z.array(z.string()),
  timestamp: z.date(),
  llm: z.string(),
  userId: z.string().optional(),
  conversationId: z.string().optional(),
  contextType: z.enum(['active', 'archived', 'summary']).optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  parentContextId: z.instanceof(ObjectId).optional(),
  messageIndex: z.number().int().optional(),
  wordCount: z.number().int().optional(),
  summaryText: z.string().optional(),
});

// Validate before saving
export async function saveMemories(
  memories: string[],
  llm: string,
  userId?: string,
): Promise<void> {
  await connect();
  
  const memoryDoc = {
    memories,
    timestamp: new Date(),
    llm,
    userId,
  };
  
  // Validate
  const validated = MemorySchema.parse(memoryDoc);
  
  await collection.insertOne(validated);
}
```

#### Benefits
- Prevents data corruption
- Better error messages
- Runtime type safety

---

## Implementation Priority

Suggested order for implementing these improvements:

1. **Error Handling** (Issues #4, #5, #7) - Foundation for reliability
2. **Security & Validation** (Issues #2, #3) - Critical for production
3. **Configuration** (Issues #27, #28) - Makes other changes easier
4. **Type Safety** (Issues #17, #19) - Improves code quality
5. **Performance** (Issue #11) - Incremental improvement
6. **Architecture** (Issues #23, #25, #26) - Long-term maintainability
7. **Code Quality** (Issues #13, #15) - Cleanup and consistency
8. **Documentation** (Issue #22) - User experience

## Acceptance Criteria

- [ ] All database operations have timeout configuration
- [ ] Input validation implemented for user content
- [ ] Error handling includes context and stack traces
- [ ] Race conditions in connection handling resolved
- [ ] State updates have rollback mechanism
- [ ] Configuration externalized to environment variables
- [ ] Schema validation added for data models
- [ ] Type safety improved (no `any` in error handling)
- [ ] Memory interface uses discriminated unions
- [ ] Magic numbers replaced with named constants
- [ ] README updated with setup and troubleshooting
- [ ] Dependency injection implemented for orchestrator
- [ ] Basic metrics collection in place

## Estimated Effort

**Total:** ~40-60 hours across all 16 issues

Key investments:
- Error handling & robustness: ~12-16 hours
- Configuration & validation: ~8-12 hours
- Architecture improvements: ~12-16 hours
- Type safety & code quality: ~8-12 hours
