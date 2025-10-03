/**
 * Configuration management for memory-mcp
 * All configuration values can be overridden via environment variables
 */

export interface MongoDBConfig {
  uri: string;
  database: string;
  collection: string;
  stateCollection: string;
  serverSelectionTimeoutMS: number;
  connectTimeoutMS: number;
  socketTimeoutMS: number;
}

export interface OrchestratorConfig {
  maxWordCount: number;
  archiveThreshold: number;
  retrieveThreshold: number;
  archivePercentage: number;
  minRelevanceScore: number;
  retrieveLimit: number;
  summaryThreshold: number;
  recommendationHighUsage: number;
  recommendationMediumUsage: number;
  recommendationLowUsage: number;
}

export interface ValidationConfig {
  maxInputLength: number;
  maxArrayItems: number;
  maxTags: number;
  maxTagLength: number;
  maxConversationIdLength: number;
  maxLlmNameLength: number;
  maxUserIdLength: number;
}

export interface AppConfig {
  mongodb: MongoDBConfig;
  orchestrator: OrchestratorConfig;
  validation: ValidationConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): AppConfig {
  return {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      database: process.env.MONGODB_DATABASE || 'memory_mcp',
      collection: process.env.MONGODB_COLLECTION || 'memories',
      stateCollection: process.env.MONGODB_STATE_COLLECTION || 'conversation_states',
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT || '5000'),
      connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT || '10000'),
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000'),
    },
    orchestrator: {
      maxWordCount: parseInt(process.env.MAX_WORD_COUNT || '8000'),
      archiveThreshold: parseFloat(process.env.ARCHIVE_THRESHOLD || '0.8'),
      retrieveThreshold: parseFloat(process.env.RETRIEVE_THRESHOLD || '0.3'),
      archivePercentage: parseFloat(process.env.ARCHIVE_PERCENTAGE || '0.3'),
      minRelevanceScore: parseFloat(process.env.MIN_RELEVANCE_SCORE || '0.2'),
      retrieveLimit: parseInt(process.env.RETRIEVE_LIMIT || '5'),
      summaryThreshold: parseInt(process.env.SUMMARY_THRESHOLD || '20'),
      recommendationHighUsage: parseFloat(process.env.RECOMMENDATION_HIGH_USAGE || '0.9'),
      recommendationMediumUsage: parseFloat(process.env.RECOMMENDATION_MEDIUM_USAGE || '0.7'),
      recommendationLowUsage: parseFloat(process.env.RECOMMENDATION_LOW_USAGE || '0.2'),
    },
    validation: {
      maxInputLength: parseInt(process.env.MAX_INPUT_LENGTH || '10000'),
      maxArrayItems: parseInt(process.env.MAX_ARRAY_ITEMS || '100'),
      maxTags: parseInt(process.env.MAX_TAGS || '50'),
      maxTagLength: parseInt(process.env.MAX_TAG_LENGTH || '100'),
      maxConversationIdLength: parseInt(process.env.MAX_CONVERSATION_ID_LENGTH || '256'),
      maxLlmNameLength: parseInt(process.env.MAX_LLM_NAME_LENGTH || '100'),
      maxUserIdLength: parseInt(process.env.MAX_USER_ID_LENGTH || '256'),
    },
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
  };
}

// Export singleton config instance
export const config = loadConfig();
