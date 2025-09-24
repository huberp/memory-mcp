import { MongoClient, ObjectId, Db, Collection } from "mongodb";
import { Memory, ContextType, SharedMemory } from "./types.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const SHARED_MONGODB_URI =
  process.env.SHARED_MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = "memory_mcp";
const COLLECTION_NAME = "memories";
const SHARED_DATABASE_NAME = "shared_memories";
const SHARED_COLLECTION_NAME = "shared_memories";

let client: MongoClient;
let db: Db;
let collection: Collection<Memory>;

// Shared memories database
let sharedClient: MongoClient;
let sharedDb: Db;
let sharedCollection: Collection<SharedMemory>;

export async function connect() {
  if (client && db && collection) return;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DATABASE_NAME);
  collection = db.collection(COLLECTION_NAME);
  return collection;
}

export async function connectShared() {
  if (sharedClient && sharedDb && sharedCollection) return;
  sharedClient = new MongoClient(SHARED_MONGODB_URI);
  await sharedClient.connect();
  sharedDb = sharedClient.db(SHARED_DATABASE_NAME);
  sharedCollection = sharedDb.collection(SHARED_COLLECTION_NAME);
  return sharedCollection;
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
  if (sharedClient) await sharedClient.close();
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

export async function saveSharedMemory(
  memory: string,
  llm: string,
  category?: string,
  tags?: string[],
): Promise<ObjectId> {
  await connectShared();

  const sharedMemory: SharedMemory = {
    memory,
    timestamp: new Date(),
    llm,
    category,
    tags,
    wordCount: memory.split(/\s+/).length,
  };

  const result = await sharedCollection.insertOne(sharedMemory);
  return result.insertedId;
}

export async function getSharedMemories(
  limit: number = 50,
  category?: string,
  tags?: string[],
): Promise<SharedMemory[]> {
  await connectShared();

  const filter: any = { isApproved: true };

  if (category) {
    filter.category = category;
  }

  if (tags && tags.length > 0) {
    filter.tags = { $in: tags };
  }

  return sharedCollection
    .find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

export async function getSharedMemoryCategories(): Promise<string[]> {
  await connectShared();

  const categories = await sharedCollection.distinct("category", {
    isApproved: true,
  });
  return categories.filter((cat) => cat !== null && cat !== undefined);
}

export async function getSharedMemoryTags(): Promise<string[]> {
  await connectShared();

  const result = await sharedCollection
    .aggregate([
      { $match: { isApproved: true, tags: { $exists: true, $ne: [] } } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
      { $project: { _id: 1 } },
    ])
    .toArray();

  return result.map((item) => item._id);
}

export async function searchSharedMemoriesByKeyword(
  keywords: string[],
  limit: number = 20,
): Promise<SharedMemory[]> {
  await connectShared();

  // Create a text search query for each keyword
  const searchQueries = keywords.map((keyword) => ({
    $or: [
      { memory: { $regex: keyword, $options: "i" } },
      { category: { $regex: keyword, $options: "i" } },
      { tags: { $regex: keyword, $options: "i" } },
    ],
  }));

  // Combine all keyword searches with AND logic
  const filter = {
    isApproved: true,
    $and: searchQueries,
  };

  return sharedCollection
    .find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

// Re-export types for convenience
export { Memory, ContextType, SharedMemory } from "./types.js";
