/**
 * Base class for relevance scorers
 * Provides common functionality for all scorer implementations
 */

import { IRelevanceScorer, ScoredMemory } from "./IRelevanceScorer.js";
import { Memory } from "../types.js";

/**
 * Abstract base class for relevance scorers
 */
export abstract class BaseScorer implements IRelevanceScorer {
  /**
   * Scores the relevance of archived memories to the current context.
   * Must be implemented by concrete scorers.
   */
  abstract scoreRelevance(currentContext: string, memories: Memory[]): Promise<ScoredMemory[]>;

  /**
   * Get the name of the scorer implementation
   */
  abstract getName(): string;

  /**
   * Optional precomputation step for embeddings or indexes
   * Override in subclasses if needed
   */
  async precompute?(memories: Memory[]): Promise<void>;

  /**
   * Helper method to validate score is in range [0, 1]
   */
  protected normalizeScore(score: number): number {
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Helper method to sort scored memories by relevance
   */
  protected sortByRelevance(memories: ScoredMemory[]): ScoredMemory[] {
    return memories.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }
}
