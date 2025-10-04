/**
 * Interface for relevance scoring strategies
 * All scorers must implement this interface to be compatible with the scoring system
 */

import { Memory } from "../types.js";

/**
 * Memory with relevance score assigned
 */
export interface ScoredMemory extends Memory {
  relevanceScore: number;
}

/**
 * Interface for relevance scoring strategies
 */
export interface IRelevanceScorer {
  /**
   * Scores the relevance of archived memories to the current context.
   * @param currentContext The current conversation context.
   * @param memories Array of archived memories to score.
   * @returns Array of memories with updated relevance scores.
   */
  scoreRelevance(currentContext: string, memories: Memory[]): Promise<ScoredMemory[]>;

  /**
   * Optional: Precompute embeddings or indexes for faster scoring.
   * This method is called when memories are archived.
   * @param memories Array of memories to precompute data for.
   */
  precompute?(memories: Memory[]): Promise<void>;

  /**
   * Get the name of the scorer implementation
   */
  getName(): string;
}
