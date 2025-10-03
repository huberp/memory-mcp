import { MongoClient, ObjectId, Db, Collection } from "mongodb";
import { Memory, ContextType } from "./types.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = "memory_mcp";
const COLLECTION_NAME = "memories";

let client: MongoClient;
let db: Db;
let collection: Collection<Memory>;

export async function connect() {
  if (client && db && collection) return;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DATABASE_NAME);
  collection = db.collection(COLLECTION_NAME);
  return collection;
}

export async function saveMemories(
  memories: string[],
  llm: string,
  userId?: string,
): Promise<void> {
  await connect();
  const memoryDoc: Memory = {
    memories,
    timestamp: new Date(),
    llm,
    userId,
  };
  await collection.insertOne(memoryDoc);
}

export async function getAllMemories(): Promise<Memory[]> {
  await connect();
  return collection.find({}).sort({ timestamp: -1 }).toArray();
}

export async function clearAllMemories(): Promise<number> {
  await connect();
  const result = await collection.deleteMany({});
  return result.deletedCount || 0;
}

export async function closeDatabase() {
  if (client) await client.close();
}

/**
 * Archives context messages for a conversation with tags and metadata.
 * 
 * @param conversationId - Unique identifier for the conversation
 * @param contextMessages - Array of context messages to archive
 * @param tags - Tags for categorizing the archived content
 * @param llm - Name of the LLM (e.g., 'chatgpt', 'claude')
 * @param userId - Optional user identifier
 * @returns The number of items archived
 * @throws {Error} If database connection fails
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

  const archivedItems: Memory[] = contextMessages.map((message, index) => ({
    memories: [message],
    timestamp: new Date(),
    llm,
    userId,
    conversationId,
    contextType: "archived",
    tags,
    messageIndex: index,
    wordCount: message.split(/\s+/).length,
  }));

  const result = await collection.insertMany(archivedItems);
  return result.insertedCount || 0;
}

/**
 * Retrieves relevant archived context for a conversation.
 * 
 * @param conversationId - Unique identifier for the conversation
 * @param tags - Optional array of tags to filter by
 * @param minRelevanceScore - Minimum relevance score (0-1) for returned items
 * @param limit - Maximum number of items to return
 * @returns Array of archived memory items matching the criteria
 * @throws {Error} If database connection fails
 * 
 * @example
 * ```typescript
 * const items = await retrieveContext(
 *   'conv-123',
 *   ['technical', 'programming'],
 *   0.2,
 *   10
 * );
 * console.log(`Retrieved ${items.length} relevant items`);
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

  return collection
    .find(filter)
    .sort({ relevanceScore: -1, timestamp: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Scores the relevance of archived items against current context.
 * Uses keyword overlap to calculate relevance scores.
 * 
 * @param conversationId - Unique identifier for the conversation
 * @param currentContext - Current conversation context to compare against
 * @param llm - Name of the LLM (e.g., 'chatgpt', 'claude')
 * @returns The number of archived items scored
 * @throws {Error} If database connection fails
 * 
 * @example
 * ```typescript
 * const count = await scoreRelevance(
 *   'conv-123',
 *   'User is asking about database performance',
 *   'claude'
 * );
 * console.log(`Scored ${count} archived items`);
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
  let scoredCount = 0;

  for (const item of archivedItems) {
    const itemText = item.memories.join(" ");
    const itemWords = new Set(itemText.toLowerCase().split(/\s+/));

    // Calculate overlap
    const intersection = new Set(
      [...currentWords].filter((x) => itemWords.has(x)),
    );
    const union = new Set([...currentWords, ...itemWords]);

    const relevanceScore = intersection.size / union.size;

    // Update the item with new relevance score
    await collection.updateOne({ _id: item._id }, { $set: { relevanceScore } });

    scoredCount++;
  }

  return scoredCount;
}

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

  return collection
    .find({ conversationId, contextType: "summary" })
    .sort({ timestamp: -1 })
    .toArray();
}

export async function searchContextByTags(tags: string[]): Promise<Memory[]> {
  await connect();

  return collection
    .find({
      tags: { $in: tags },
      contextType: { $in: ["archived", "summary"] },
    })
    .sort({ relevanceScore: -1, timestamp: -1 })
    .toArray();
}

// Re-export types for convenience
export { Memory, ContextType } from "./types.js";
