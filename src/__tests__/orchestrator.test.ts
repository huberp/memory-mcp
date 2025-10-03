import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the db module before importing orchestrator
jest.unstable_mockModule('../db.js', () => ({
  connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  archiveContext: jest.fn<() => Promise<number>>().mockResolvedValue(5),
  retrieveContext: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  scoreRelevance: jest.fn<() => Promise<number>>().mockResolvedValue(0),
  createSummary: jest.fn<() => Promise<any>>().mockResolvedValue({ toString: () => '123' }),
  getConversationSummaries: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
  saveConversationState: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  getConversationState: jest.fn<() => Promise<any>>().mockResolvedValue(null),
  deleteConversationState: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

const { ConversationOrchestrator } = await import('../orchestrator.js');

describe('ConversationOrchestrator', () => {
  let orchestrator: InstanceType<typeof ConversationOrchestrator>;

  beforeEach(() => {
    orchestrator = new ConversationOrchestrator(1000);
  });

  describe('initializeConversation', () => {
    it('should create new conversation state', async () => {
      const state = await orchestrator.initializeConversation(
        'test-conversation',
        'claude',
        'user-123'
      );

      expect(state.conversationId).toBe('test-conversation');
      expect(state.llm).toBe('claude');
      expect(state.userId).toBe('user-123');
      expect(state.currentContext).toEqual([]);
      expect(state.totalWordCount).toBe(0);
      expect(state.maxWordCount).toBe(1000);
    });

    it('should return existing conversation state', async () => {
      const state1 = await orchestrator.initializeConversation(
        'test-conversation',
        'claude'
      );
      const state2 = await orchestrator.initializeConversation(
        'test-conversation',
        'claude'
      );

      expect(state1).toBe(state2);
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation', async () => {
      const result = await orchestrator.addMessage(
        'test-conversation',
        'This is a test message',
        'claude'
      );

      expect(result.state.currentContext).toHaveLength(1);
      expect(result.state.currentContext[0]).toBe('This is a test message');
      expect(result.state.totalWordCount).toBe(5);
    });

    it('should not trigger archiving when below threshold', async () => {
      const result = await orchestrator.addMessage(
        'test-conversation',
        'Short message',
        'claude'
      );

      expect(result.archiveDecision?.shouldArchive).toBe(false);
    });

    it('should trigger archiving when above threshold', async () => {
      // Add enough messages to exceed 80% of 1000 words
      const longMessage = Array(200).fill('word').join(' '); // 200 words
      
      for (let i = 0; i < 5; i++) {
        await orchestrator.addMessage(
          'test-conversation',
          longMessage,
          'claude'
        );
      }

      const result = await orchestrator.addMessage(
        'test-conversation',
        longMessage,
        'claude'
      );

      expect(result.archiveDecision?.shouldArchive).toBe(true);
      expect(result.archiveDecision?.messagesToArchive.length).toBeGreaterThan(0);
    });
  });

  describe('getConversationStatus', () => {
    it('should return conversation state and recommendations', async () => {
      await orchestrator.initializeConversation(
        'test-conversation',
        'claude'
      );

      const status = await orchestrator.getConversationStatus('test-conversation');

      expect(status.state).toBeDefined();
      expect(status.recommendations).toBeDefined();
      expect(Array.isArray(status.recommendations)).toBe(true);
    });

    it('should recommend retrieval when context is low', async () => {
      await orchestrator.initializeConversation(
        'test-conversation',
        'claude'
      );

      const status = await orchestrator.getConversationStatus('test-conversation');

      // Low usage should suggest retrieval
      expect(status.recommendations.some(r => r.includes('retrieving'))).toBe(true);
    });

    it('should throw error for non-existent conversation', async () => {
      await expect(
        orchestrator.getConversationStatus('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getActiveConversations', () => {
    it('should return list of active conversation ids', async () => {
      await orchestrator.initializeConversation('conv-1', 'claude');
      await orchestrator.initializeConversation('conv-2', 'chatgpt');
      await orchestrator.initializeConversation('conv-3', 'claude');

      const conversations = orchestrator.getActiveConversations();

      expect(conversations).toHaveLength(3);
      expect(conversations).toContain('conv-1');
      expect(conversations).toContain('conv-2');
      expect(conversations).toContain('conv-3');
    });
  });

  describe('removeConversation', () => {
    it('should remove conversation from active list', async () => {
      await orchestrator.initializeConversation('test-conversation', 'claude');
      
      expect(orchestrator.getActiveConversations()).toContain('test-conversation');
      
      await orchestrator.removeConversation('test-conversation');
      
      expect(orchestrator.getActiveConversations()).not.toContain('test-conversation');
    });
  });

  describe('state persistence', () => {
    it('should load state from database on initialization', async () => {
      // Mock getConversationState to return a saved state
      const mockDb = await import('../db.js');
      const getStateMock = mockDb.getConversationState as any;
      
      const savedState = {
        conversationId: 'persisted-conv',
        currentContext: ['message1', 'message2'],
        archivedContext: [],
        summaries: [],
        totalWordCount: 4,
        maxWordCount: 1000,
        llm: 'claude',
        userId: 'user-123'
      };
      
      getStateMock.mockResolvedValueOnce(savedState);
      
      const state = await orchestrator.initializeConversation('persisted-conv', 'claude');
      
      expect(state.currentContext).toEqual(['message1', 'message2']);
      expect(state.totalWordCount).toBe(4);
    });
  });
});
