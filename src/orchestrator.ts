import {
  connect,
  archiveContext,
  retrieveContext,
  scoreRelevance,
  createSummary,
  getConversationSummaries,
} from "./db.js";
import {
  Memory,
  ConversationState,
  ArchiveDecision,
  RetrievalDecision,
} from "./types.js";
import { logger } from "./logger.js";
import { getWordCount } from "./wordcount.js";

export class ConversationOrchestrator {
  private conversations: Map<string, ConversationState> = new Map();
  private readonly ARCHIVE_THRESHOLD = 0.8; // Archive when 80% full
  private readonly RETRIEVE_THRESHOLD = 0.3; // Retrieve when 30% full

  constructor(private maxWordCount: number = 8000) {}

  /**
   * Initialize or get a conversation state
   */
  async initializeConversation(
    conversationId: string,
    llm: string,
    userId?: string,
  ): Promise<ConversationState> {
    await connect();

    if (!this.conversations.has(conversationId)) {
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
      this.conversations.set(conversationId, state);
    }

    return this.conversations.get(conversationId)!;
  }

  /**
   * Add a new message to the conversation and manage context
   */
  async addMessage(
    conversationId: string,
    message: string,
    llm: string,
    userId?: string,
  ): Promise<{
    state: ConversationState;
    archiveDecision?: ArchiveDecision;
    retrievalDecision?: RetrievalDecision;
  }> {
    const state = await this.initializeConversation(conversationId, llm, userId);

    // Add message to current context
    state.currentContext.push(message);
    state.totalWordCount += getWordCount(message);

    // Check if we need to archive
    const archiveDecision = await this.shouldArchive(state);

    // Check if we need to retrieve archived content
    const retrievalDecision = await this.shouldRetrieve(state);

    return { state, archiveDecision, retrievalDecision };
  }

  /**
   * Determine if content should be archived
   */
  private async shouldArchive(state: ConversationState): Promise<ArchiveDecision> {
    const usageRatio = state.totalWordCount / state.maxWordCount;

    if (usageRatio < this.ARCHIVE_THRESHOLD) {
      return { shouldArchive: false, messagesToArchive: [], tags: [], reason: "Below archive threshold" };
    }

    // Archive oldest messages (first 30% of current context)
    const messagesToArchive = state.currentContext.slice(0, Math.floor(state.currentContext.length * 0.3));
    const tags = this.generateTags(messagesToArchive);

    return {
      shouldArchive: true,
      messagesToArchive,
      tags,
      reason: `Context usage at ${(usageRatio * 100).toFixed(1)}%, archiving oldest ${messagesToArchive.length} messages`,
    };
  }

  /**
   * Determine if archived content should be retrieved
   */
  private async shouldRetrieve(state: ConversationState): Promise<RetrievalDecision> {
    const usageRatio = state.totalWordCount / state.maxWordCount;

    if (usageRatio > this.RETRIEVE_THRESHOLD) {
      return { shouldRetrieve: false, contextToRetrieve: [], reason: "Above retrieve threshold" };
    }

    // Score relevance of archived content
    const currentContextText = state.currentContext.join(" ");
    await scoreRelevance(state.conversationId, currentContextText, state.llm);

    // Retrieve most relevant archived content
    const relevantContext = await retrieveContext(
      state.conversationId,
      undefined, // no tag filter
      0.2, // minimum relevance score
      5, // limit to 5 items
    );

    if (relevantContext.length === 0) {
      return { shouldRetrieve: false, contextToRetrieve: [], reason: "No relevant archived content found" };
    }

    return {
      shouldRetrieve: true,
      contextToRetrieve: relevantContext,
      reason: `Context usage at ${(usageRatio * 100).toFixed(1)}%, retrieving ${relevantContext.length} relevant archived items`,
    };
  }

  /**
   * Execute archiving decision by moving messages from current context to archive.
   * Updates the conversation state after successful archiving.
   * 
   * @param decision - The archiving decision with messages to archive
   * @param state - Current conversation state to update
   * @throws {Error} If database archiving fails
   * 
   * @example
   * ```typescript
   * const decision = await orchestrator.shouldArchive(state);
   * if (decision.shouldArchive) {
   *   await orchestrator.executeArchive(decision, state);
   * }
   * ```
   */
  async executeArchive(decision: ArchiveDecision, state: ConversationState): Promise<void> {
    if (!decision.shouldArchive) return;

    // Archive the messages
    const archivedCount = await archiveContext(
      state.conversationId,
      decision.messagesToArchive,
      decision.tags,
      state.llm,
      state.userId,
    );

    // Remove archived messages from current context
    const archivedWordCount = decision.messagesToArchive.reduce(
      (sum, msg) => sum + getWordCount(msg),
      0,
    );

    state.currentContext = state.currentContext.slice(decision.messagesToArchive.length);
    state.totalWordCount -= archivedWordCount;

    logger.info(`Archived ${archivedCount} messages for conversation ${state.conversationId}`);
  }

  /**
   * Execute retrieval decision by adding relevant archived content to current context.
   * Updates the conversation state with retrieved content.
   * 
   * @param decision - The retrieval decision with content to retrieve
   * @param state - Current conversation state to update
   * 
   * @example
   * ```typescript
   * const decision = await orchestrator.shouldRetrieve(state);
   * if (decision.shouldRetrieve) {
   *   await orchestrator.executeRetrieval(decision, state);
   * }
   * ```
   */
  async executeRetrieval(decision: RetrievalDecision, state: ConversationState): Promise<void> {
    if (!decision.shouldRetrieve) return;

    // Add retrieved context to current context
    for (const item of decision.contextToRetrieve) {
      const content = item.memories.join(" ");
      state.currentContext.unshift(content); // Add to beginning
      state.totalWordCount += getWordCount(content);
    }

    logger.info(`Retrieved ${decision.contextToRetrieve.length} items for conversation ${state.conversationId}`);
  }

  /**
   * Create a summary of archived content
   */
  async createSummary(
    conversationId: string,
    summaryText: string,
    llm: string,
    userId?: string,
  ): Promise<void> {
    const state = this.conversations.get(conversationId);
    if (!state) throw new Error(`Conversation ${conversationId} not found`);

    // Get archived items to summarize
    const archivedItems = await retrieveContext(conversationId, undefined, 0.1, 10);

    if (archivedItems.length === 0) {
      throw new Error("No archived items to summarize");
    }

    // Create summary
    const summaryId = await createSummary(
      conversationId,
      archivedItems,
      summaryText,
      llm,
      userId,
    );

    logger.info(`Created summary ${summaryId} for conversation ${conversationId}`);
  }

  /**
   * Get conversation state and recommendations
   */
  async getConversationStatus(conversationId: string): Promise<{
    state: ConversationState;
    recommendations: string[];
  }> {
    const state = this.conversations.get(conversationId);
    if (!state) throw new Error(`Conversation ${conversationId} not found`);

    const usageRatio = state.totalWordCount / state.maxWordCount;
    const recommendations: string[] = [];

    if (usageRatio > 0.9) {
      recommendations.push("⚠️ Context window nearly full - consider archiving more content");
    } else if (usageRatio > 0.7) {
      recommendations.push("📝 Consider archiving older messages to free up space");
    } else if (usageRatio < 0.2) {
      recommendations.push("🔍 Context window has space - consider retrieving relevant archived content");
    }

    if (state.archivedContext.length > 20) {
      recommendations.push("📋 Consider creating summaries of archived content");
    }

    return { state, recommendations };
  }

  /**
   * Generate tags based on message content
   */
  private generateTags(messages: string[]): string[] {
    const allText = messages.join(" ").toLowerCase();
    const tags: string[] = [];

    // Use word boundaries for better matching
    const keywords = {
      programming: /\b(code|coding|programming|developer|software)\b/,
      technical: /\b(technical|api|database|server|client)\b/,
      frontend: /\b(frontend|ui|ux|interface|design)\b/,
      backend: /\b(backend|server|database|api)\b/,
      data: /\b(data|analysis|analytics|research)\b/,
      writing: /\b(writing|content|creative|documentation)\b/,
      business: /\b(business|strategy|planning|management)\b/,
    };

    for (const [tag, pattern] of Object.entries(keywords)) {
      if (pattern.test(allText)) {
        tags.push(tag);
      }
    }

    return tags.length > 0 ? tags : ["general"];
  }

  /**
   * Clean up conversation state
   */
  removeConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /**
   * Get all active conversations
   */
  getActiveConversations(): string[] {
    return Array.from(this.conversations.keys());
  }
}

// Re-export types for convenience
export { ConversationState, ArchiveDecision, RetrievalDecision } from "./types.js";
