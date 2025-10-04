/**
 * Keyword-based relevance scorer using Jaccard similarity
 * This is the original scoring implementation, maintained for backward compatibility
 */

import { BaseScorer } from "./BaseScorer.js";
import { Memory } from "../types.js";
import { ScoredMemory } from "./IRelevanceScorer.js";

/**
 * Keyword scorer using Jaccard similarity (word overlap)
 */
export class KeywordScorer extends BaseScorer {
  getName(): string {
    return "keyword";
  }

  /**
   * Score relevance using Jaccard similarity (word overlap)
   * @param currentContext Current conversation context
   * @param memories Archived memories to score
   * @returns Scored memories sorted by relevance
   */
  async scoreRelevance(currentContext: string, memories: Memory[]): Promise<ScoredMemory[]> {
    const currentWords = new Set(currentContext.toLowerCase().split(/\s+/));
    
    const scoredMemories: ScoredMemory[] = memories.map((memory) => {
      const itemText = memory.memories.join(" ");
      const itemWords = new Set(itemText.toLowerCase().split(/\s+/));

      // Calculate Jaccard similarity: intersection / union
      const intersection = new Set(
        [...currentWords].filter((x) => itemWords.has(x)),
      );
      const union = new Set([...currentWords, ...itemWords]);

      const relevanceScore = union.size > 0 ? intersection.size / union.size : 0;

      return {
        ...memory,
        relevanceScore: this.normalizeScore(relevanceScore),
      };
    });

    return this.sortByRelevance(scoredMemories);
  }
}
