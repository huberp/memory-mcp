import { MongoClient, ObjectId, Db, Collection } from "mongodb";
import { Memory, ContextType, ConversationState } from "./types.js";
import { validateStringArray, validateTags, validateConversationId, sanitizeInput } from "./validation.js";
import { config } from "./config.js";
import { logger } from "./logger.js";

const MONGODB_URI = config.mongodb.uri;
const DATABASE_NAME = config.mongodb.database;
const COLLECTION_NAME = config.mongodb.collection;
const STATE_COLLECTION_NAME = config.mongodb.stateCollection;

let client: MongoClient;
let db: Db;
let collection: Collection<Memory>;
let stateCollection: Collection<any>;
let connectionPromise: Promise<void> | null = null;

function validateMongoUri(uri: string): void {
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB connection string format');
  }
  // Warn if using default insecure connection
  if (uri === 'mongodb://localhost:27017') {
    logger.warn('Using default MongoDB connection without authentication');
  }
}

async function createIndexes() {
  if (!collection) return;
  
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
  
  // Create indexes for conversation states collection
  if (stateCollection) {
    await stateCollection.createIndex(
      { conversationId: 1 },
      { unique: true, background: true }
    );
    
    await stateCollection.createIndex(
      { lastUpdated: -1 },
      { background: true }
    );
  }
  
  logger.info('Database indexes created');
}

export async function connect() {
  if (client && db && collection && stateCollection) return;
  
  // Prevent race conditions - return existing connection attempt
  if (connectionPromise) {
    await connectionPromise;
    return;
  }
  
  connectionPromise = (async () => {
    // Validate MongoDB URI before connecting
    validateMongoUri(MONGODB_URI);
    
    // Configure connection with timeouts from config
    const options = {
      serverSelectionTimeoutMS: config.mongodb.serverSelectionTimeoutMS,
      connectTimeoutMS: config.mongodb.connectTimeoutMS,
      socketTimeoutMS: config.mongodb.socketTimeoutMS,
    };
    
    client = new MongoClient(MONGODB_URI, options);
    await client.connect();
    db = client.db(DATABASE_NAME);
    collection = db.collection(COLLECTION_NAME);
    stateCollection = db.collection(STATE_COLLECTION_NAME);
    
    // Create indexes on first connection
    await createIndexes();
  })();
  
  try {
    await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

/**
 * Save memories to the database
 * @param memories - Array of memory strings to save
 * @param llm - Name of the LLM (e.g., 'chatgpt', 'claude')
 * @param userId - Optional user identifier
 * @throws {Error} If validation fails or database operation fails
 * 
 * @example
 * ```typescript
 * await saveMemories(
 *   ['User asked about TypeScript', 'Explained types'],
 *   'claude',
 *   'user-123'
 * );
 * ```
 */
export async function saveMemories(
  memories: string[],
  llm: string,
  userId?: string,
): Promise<void> {
  await connect();
  
  // Validate inputs
  const validatedMemories = validateStringArray(memories);
  const validatedLlm = sanitizeInput(llm, 100);
  
  const memoryDoc: Memory = {
    memories: validatedMemories,
    timestamp: new Date(),
    llm: validatedLlm,
    userId: userId ? sanitizeInput(userId, 256) : undefined,
  };
  await collection.insertOne(memoryDoc);
}

/**
 * Retrieve all memories from the database
 * @returns Array of memory objects, sorted by timestamp (newest first)
 * @throws {Error} If database connection fails
 * 
 * @example
 * ```typescript
 * const memories = await getAllMemories();
 * console.log(`Found ${memories.length} memories`);
 * ```
 */
export async function getAllMemories(): Promise<Memory[]> {
  await connect();
  return collection.find({}).sort({ timestamp: -1 }).toArray();
}

/**
 * Clear all memories from the database
 * @returns The number of memory entries deleted
 * @throws {Error} If database connection fails
 * 
 * @example
 * ```typescript
 * const deletedCount = await clearAllMemories();
 * console.log(`Deleted ${deletedCount} memories`);
 * ```
 */
export async function clearAllMemories(): Promise<number> {
  await connect();
  const result = await collection.deleteMany({});
  return result.deletedCount || 0;
}

/**
 * Close the database connection
 * Should be called during application shutdown for proper cleanup
 * 
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await closeDatabase();
 *   process.exit(0);
 * });
 * ```
 */
export async function closeDatabase() {
  if (client) await client.close();
}

/**
 * Check database health and connectivity
 * @returns Object containing health status and database info
 * @throws {Error} If database connection or ping fails
 * 
 * @example
 * ```typescript
 * const health = await checkDatabaseHealth();
 * console.log(`Database status: ${health.status}`);
 * ```
 */
export async function checkDatabaseHealth(): Promise<{
  status: string;
  timestamp: string;
  database: string;
  connected: boolean;
}> {
  await connect();
  
  // Test database connection with ping
  const pingResult = await db.admin().ping();
  
  return {
    status: pingResult.ok === 1 ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
    connected: !!client,
  };
}

/**
 * Archive context messages for a conversation with tags and metadata
 * @param conversationId - Unique identifier for the conversation
 * @param contextMessages - Array of context messages to archive
 * @param tags - Tags for categorizing the archived content
 * @param llm - Name of the LLM (e.g., 'chatgpt', 'claude')
 * @param userId - Optional user identifier
 * @returns The number of items archived
 * @throws {Error} If validation fails or database operation fails
 * 
 * @example
 * ```typescript
 * const count = await archiveContext(
 *   'conv-123',
 *   ['Hello', 'How are you?'],
 *   ['greeting', 'casual'],
 *   'claude'
 * );
 * console.log(`Archived ${count} messages`);
 * ```
 */
export async function archiveContext(
  conversationId: string,
  contextMessages: string[],
  tags: string[],
  llm: string,
  userId?: string,
): Promise<number> {
  await connect();

  // Validate inputs
  const validatedConversationId = validateConversationId(conversationId);
  const validatedMessages = validateStringArray(contextMessages);
  const validatedTags = validateTags(tags);
  const validatedLlm = sanitizeInput(llm, 100);

  const archivedItems: Memory[] = validatedMessages.map((message, index) => ({
    memories: [message],
    timestamp: new Date(),
    llm: validatedLlm,
    userId: userId ? sanitizeInput(userId, 256) : undefined,
    conversationId: validatedConversationId,
    contextType: "archived",
    tags: validatedTags,
    messageIndex: index,
    wordCount: message.split(/\s+/).length,
  }));

  const result = await collection.insertMany(archivedItems);
  return result.insertedCount || 0;
}

/**
 * Retrieve relevant archived context for a conversation
 * @param conversationId - Unique identifier for the conversation
 * @param tags - Optional tags to filter archived content by
 * @param minRelevanceScore - Minimum relevance score (0-1), defaults to 0.1
 * @param limit - Maximum number of items to return, defaults to 10
 * @returns Array of archived context items sorted by relevance score
 * @throws {Error} If database connection fails
 * 
 * @example
 * ```typescript
 * const relevantContext = await retrieveContext(
 *   'conv-123',
 *   ['technical', 'api'],
 *   0.5,
 *   5
 * );
 * console.log(`Found ${relevantContext.length} relevant items`);
 * ```
 */
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

  // Use projection to only fetch needed fields
  return collection
    .find(filter)
    .project({
      memories: 1,
      timestamp: 1,
      relevanceScore: 1,
      tags: 1,
      wordCount: 1,
      llm: 1,
      userId: 1,
      conversationId: 1,
      contextType: 1,
    })
    .sort({ relevanceScore: -1, timestamp: -1 })
    .limit(limit)
    .toArray() as Promise<Memory[]>;
}

/**
 * Score the relevance of archived context against current conversation context
 * Uses Jaccard similarity (word overlap) to calculate relevance scores
 * @param conversationId - Unique identifier for the conversation
 * @param currentContext - Current conversation context to compare against
 * @param llm - Name of the LLM
 * @returns The number of archived items scored
 * @throws {Error} If database connection fails
 * 
 * @example
 * ```typescript
 * const scoredCount = await scoreRelevance(
 *   'conv-123',
 *   'discussing API design patterns',
 *   'claude'
 * );
 * console.log(`Scored ${scoredCount} archived items`);
 * ```
 */
export async function scoreRelevance(
  conversationId: string,
  currentContext: string,
  llm: string,
): Promise<number> {
  await connect();

  // Get all archived items for this conversation
  const archivedItems = await collection
    .find({ conversationId, contextType: "archived" })
    .toArray();

  if (archivedItems.length === 0) return 0;

  // Simple keyword overlap scoring
  const currentWords = new Set(currentContext.toLowerCase().split(/\s+/));
  const bulkOps = [];

  for (const item of archivedItems) {
    const itemText = item.memories.join(" ");
    const itemWords = new Set(itemText.toLowerCase().split(/\s+/));

    // Calculate overlap
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

/**
 * Create a summary of context items and link them to the summary
 * @param conversationId - Unique identifier for the conversation
 * @param contextItems - Array of context items to summarize
 * @param summaryText - Human-provided summary text
 * @param llm - Name of the LLM
 * @param userId - Optional user identifier
 * @returns The ObjectId of the created summary
 * @throws {Error} If database connection fails
 * 
 * @example
 * ```typescript
 * const summaryId = await createSummary(
 *   'conv-123',
 *   archivedItems,
 *   'Discussed TypeScript types and interfaces',
 *   'claude',
 *   'user-123'
 * );
 * console.log(`Created summary ${summaryId}`);
 * ```
 */
export async function createSummary(
  conversationId: string,
  contextItems: Memory[],
  summaryText: string,
  llm: string,
  userId?: string,
): Promise<ObjectId> {
  await connect();

  // Create summary entry
  const summaryDoc: Memory = {
    memories: [summaryText],
    timestamp: new Date(),
    llm,
    userId,
    conversationId,
    contextType: "summary",
    summaryText,
    wordCount: summaryText.split(/\s+/).length,
  };

  const result = await collection.insertOne(summaryDoc);
  const summaryId = result.insertedId;

  // Mark original items as archived and link to summary
  const itemIds = contextItems
    .map((item) => item._id)
    .filter((id): id is ObjectId => id !== undefined);

  if (itemIds.length > 0) {
    await collection.updateMany(
      { _id: { $in: itemIds } },
      {
        $set: {
          contextType: "archived",
          parentContextId: summaryId,
        },
      },
    );
  }

  return summaryId;
}

export async function getConversationSummaries(
  conversationId: string,
): Promise<Memory[]> {
  await connect();

  // Use projection to only fetch needed fields for summaries
  return collection
    .find({ conversationId, contextType: "summary" })
    .project({
      summaryText: 1,
      timestamp: 1,
      wordCount: 1,
      llm: 1,
      userId: 1,
      conversationId: 1,
      contextType: 1,
      memories: 1,
    })
    .sort({ timestamp: -1 })
    .toArray() as Promise<Memory[]>;
}

export async function searchContextByTags(tags: string[]): Promise<Memory[]> {
  await connect();

  // Use projection to fetch only needed fields
  return collection
    .find({
      tags: { $in: tags },
      contextType: { $in: ["archived", "summary"] },
    })
    .project({
      memories: 1,
      timestamp: 1,
      relevanceScore: 1,
      tags: 1,
      wordCount: 1,
      contextType: 1,
      conversationId: 1,
      summaryText: 1,
      llm: 1,
      userId: 1,
    })
    .sort({ relevanceScore: -1, timestamp: -1 })
    .toArray() as Promise<Memory[]>;
}

// Conversation state persistence functions
export async function saveConversationState(state: ConversationState): Promise<void> {
  await connect();

  const stateDoc = {
    conversationId: state.conversationId,
    currentContext: state.currentContext,
    totalWordCount: state.totalWordCount,
    maxWordCount: state.maxWordCount,
    llm: state.llm,
    userId: state.userId,
    lastUpdated: new Date(),
  };

  await stateCollection.updateOne(
    { conversationId: state.conversationId },
    { $set: stateDoc },
    { upsert: true }
  );
}

export async function getConversationState(conversationId: string): Promise<ConversationState | null> {
  await connect();

  const stateDoc = await stateCollection.findOne({ conversationId });
  
  if (!stateDoc) return null;

  // Load archived context and summaries from memories collection
  const archivedContext = await collection
    .find({ conversationId, contextType: "archived" })
    .sort({ timestamp: -1 })
    .toArray();

  const summaries = await collection
    .find({ conversationId, contextType: "summary" })
    .sort({ timestamp: -1 })
    .toArray();

  return {
    conversationId: stateDoc.conversationId,
    currentContext: stateDoc.currentContext || [],
    archivedContext,
    summaries,
    totalWordCount: stateDoc.totalWordCount || 0,
    maxWordCount: stateDoc.maxWordCount,
    llm: stateDoc.llm,
    userId: stateDoc.userId,
  };
}

export async function deleteConversationState(conversationId: string): Promise<void> {
  await connect();

  await stateCollection.deleteOne({ conversationId });
}

// Re-export types for convenience
export { Memory, ContextType } from "./types.js";
