/**
 * Sentence-BERT based relevance scorer using semantic embeddings
 * Requires a SBERT microservice or compatible embedding API
 */

import { BaseScorer } from "./BaseScorer.js";
import { Memory } from "../types.js";
import { ScoredMemory } from "./IRelevanceScorer.js";
import { cosineSimilarity } from "./vectorUtils.js";
import { logger } from "../logger.js";

/**
 * Configuration for SBERT scorer
 */
export interface SentenceBertConfig {
  model: string;
  serviceUrl: string;
  timeout?: number;
}

/**
 * Response from SBERT embedding service
 */
interface EmbeddingResponse {
  embedding: number[];
}

/**
 * Sentence-BERT scorer using semantic embeddings
 */
export class SentenceBertScorer extends BaseScorer {
  private model: string;
  private serviceUrl: string;
  private timeout: number;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(config: SentenceBertConfig) {
    super();
    this.model = config.model;
    this.serviceUrl = config.serviceUrl;
    this.timeout = config.timeout || 30000; // 30 seconds default
  }

  getName(): string {
    return "sbert";
  }

  /**
   * Score relevance using semantic embeddings and cosine similarity
   * @param currentContext Current conversation context
   * @param memories Archived memories to score
   * @returns Scored memories sorted by relevance
   */
  async scoreRelevance(currentContext: string, memories: Memory[]): Promise<ScoredMemory[]> {
    try {
      // Get embedding for current context
      const currentEmbedding = await this.getEmbedding(currentContext);

      // Score each memory
      const scoredMemories: ScoredMemory[] = await Promise.all(
        memories.map(async (memory) => {
          try {
            const memoryText = memory.memories.join(" ");
            
            // Use cached embedding if available, otherwise compute
            const memoryEmbedding = memory.embedding || (await this.getEmbedding(memoryText));
            
            // Calculate cosine similarity
            const score = cosineSimilarity(currentEmbedding, memoryEmbedding);

            return {
              ...memory,
              embedding: memoryEmbedding,
              relevanceScore: this.normalizeScore(score),
            };
          } catch (error) {
            logger.warn(`Failed to score memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
              ...memory,
              relevanceScore: 0,
            };
          }
        })
      );

      return this.sortByRelevance(scoredMemories);
    } catch (error) {
      logger.error(`SBERT scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to score relevance with SBERT: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Precompute embeddings for memories
   * @param memories Memories to precompute embeddings for
   */
  async precompute(memories: Memory[]): Promise<void> {
    try {
      await Promise.all(
        memories.map(async (memory) => {
          if (!memory.embedding) {
            const memoryText = memory.memories.join(" ");
            memory.embedding = await this.getEmbedding(memoryText);
          }
        })
      );
    } catch (error) {
      logger.warn(`Failed to precompute embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get embedding for a text string
   * Uses caching to avoid redundant API calls
   * @param text Text to embed
   * @returns Embedding vector
   */
  private async getEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.serviceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, model: this.model }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`SBERT service returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as number[] | EmbeddingResponse;
      
      // Handle different response formats
      const embedding = Array.isArray(data) ? data : data.embedding;

      // Cache the embedding
      this.embeddingCache.set(cacheKey, embedding);

      // Limit cache size to prevent memory issues
      if (this.embeddingCache.size > 1000) {
        const firstKey = this.embeddingCache.keys().next().value as string;
        if (firstKey) {
          this.embeddingCache.delete(firstKey);
        }
      }

      return embedding;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`SBERT service timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Generate cache key for text
   * Uses first 200 characters to avoid excessive memory usage
   */
  private getCacheKey(text: string): string {
    return text.substring(0, 200);
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}
