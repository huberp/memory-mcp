/**
 * Factory for creating relevance scorer instances
 * Supports different scoring strategies based on configuration
 */

import { IRelevanceScorer } from "./IRelevanceScorer.js";
import { KeywordScorer } from "./KeywordScorer.js";
import { SentenceBertScorer } from "./SentenceBertScorer.js";
import { logger } from "../logger.js";

export type ScorerType = "keyword" | "sbert" | "custom";

/**
 * Configuration for scorer factory
 */
export interface ScorerConfig {
  type: ScorerType;
  sbertModel?: string;
  sbertServiceUrl?: string;
  sbertTimeout?: number;
  customScorer?: IRelevanceScorer;
}

/**
 * Factory class for creating relevance scorers
 */
export class ScorerFactory {
  /**
   * Create a scorer instance based on configuration
   * @param config Scorer configuration
   * @returns Relevance scorer instance
   */
  static createScorer(config: ScorerConfig): IRelevanceScorer {
    switch (config.type) {
      case "keyword":
        logger.info("Using keyword-based relevance scorer");
        return new KeywordScorer();

      case "sbert":
        if (!config.sbertServiceUrl) {
          logger.warn("SBERT service URL not configured, falling back to keyword scorer");
          return new KeywordScorer();
        }
        logger.info(`Using SBERT relevance scorer with model: ${config.sbertModel || 'default'}`);
        return new SentenceBertScorer({
          model: config.sbertModel || "all-MiniLM-L6-v2",
          serviceUrl: config.sbertServiceUrl,
          timeout: config.sbertTimeout,
        });

      case "custom":
        if (!config.customScorer) {
          logger.warn("Custom scorer not provided, falling back to keyword scorer");
          return new KeywordScorer();
        }
        logger.info(`Using custom relevance scorer: ${config.customScorer.getName()}`);
        return config.customScorer;

      default:
        logger.warn(`Unknown scorer type: ${config.type}, falling back to keyword scorer`);
        return new KeywordScorer();
    }
  }

  /**
   * Create scorer from environment variables
   * @returns Relevance scorer instance
   */
  static createScorerFromEnv(): IRelevanceScorer {
    const scorerType = (process.env.RELEVANCE_SCORER_TYPE || "keyword") as ScorerType;
    
    const config: ScorerConfig = {
      type: scorerType,
      sbertModel: process.env.SBERT_MODEL,
      sbertServiceUrl: process.env.SBERT_SERVICE_URL,
      sbertTimeout: process.env.SBERT_TIMEOUT ? parseInt(process.env.SBERT_TIMEOUT) : undefined,
    };

    return ScorerFactory.createScorer(config);
  }
}
