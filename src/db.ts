import { MongoClient, ObjectId, Db, Collection } from "mongodb";
import { Memory, ContextType } from "./types.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = "memory_mcp";
const COLLECTION_NAME = "memories";

let client: MongoClient;
let db: Db;
let collection: Collection<Memory>;

function validateMongoUri(uri: string): void {
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB connection string format');
  }
  // Warn if using default insecure connection
  if (uri === 'mongodb://localhost:27017') {
    console.warn('⚠️  Using default MongoDB connection without authentication');
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
  
  console.error('✅ Database indexes created');
}

export async function connect() {
  if (client && db && collection) return;
  
  // Validate MongoDB URI before connecting
  validateMongoUri(MONGODB_URI);
  
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DATABASE_NAME);
  collection = db.collection(COLLECTION_NAME);
  
  // Create indexes on first connection
  await createIndexes();
  
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
