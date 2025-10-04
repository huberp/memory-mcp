import { describe, it, expect } from '@jest/globals';
import { KeywordScorer } from '../scorers/KeywordScorer.js';
import { cosineSimilarity } from '../scorers/vectorUtils.js';
import { Memory } from '../types.js';

describe('Scorer Module', () => {
  describe('KeywordScorer', () => {
    const scorer = new KeywordScorer();

    it('should return correct scorer name', () => {
      expect(scorer.getName()).toBe('keyword');
    });

    it('should calculate correct relevance score for overlapping words', async () => {
      const currentContext = 'the quick brown fox jumps';
      const memories: Memory[] = [
        {
          memories: ['the lazy brown dog sleeps'],
          timestamp: new Date(),
          llm: 'test',
        },
      ];

      const results = await scorer.scoreRelevance(currentContext, memories);

      // 'the' and 'brown' are common = 2 words
      // Total unique words = 8 (the, quick, brown, fox, jumps, lazy, dog, sleeps)
      expect(results).toHaveLength(1);
      expect(results[0].relevanceScore).toBeCloseTo(2 / 8, 5);
    });

    it('should return 1.0 for identical texts', async () => {
      const text = 'identical text here';
      const memories: Memory[] = [
        {
          memories: [text],
          timestamp: new Date(),
          llm: 'test',
        },
      ];

      const results = await scorer.scoreRelevance(text, memories);

      expect(results).toHaveLength(1);
      expect(results[0].relevanceScore).toBe(1.0);
    });

    it('should return 0.0 for completely different texts', async () => {
      const currentContext = 'apple banana cherry';
      const memories: Memory[] = [
        {
          memories: ['dog cat bird'],
          timestamp: new Date(),
          llm: 'test',
        },
      ];

      const results = await scorer.scoreRelevance(currentContext, memories);

      expect(results).toHaveLength(1);
      expect(results[0].relevanceScore).toBe(0);
    });

    it('should handle empty memories array', async () => {
      const results = await scorer.scoreRelevance('some text', []);
      expect(results).toHaveLength(0);
    });

    it('should sort results by relevance score in descending order', async () => {
      const currentContext = 'javascript programming language';
      const memories: Memory[] = [
        {
          memories: ['python is a programming language'],
          timestamp: new Date(),
          llm: 'test',
        },
        {
          memories: ['javascript is great for web development'],
          timestamp: new Date(),
          llm: 'test',
        },
        {
          memories: ['cooking recipes for dinner'],
          timestamp: new Date(),
          llm: 'test',
        },
      ];

      const results = await scorer.scoreRelevance(currentContext, memories);

      expect(results).toHaveLength(3);
      // Should be sorted in descending order
      expect(results[0].relevanceScore).toBeGreaterThanOrEqual(results[1].relevanceScore);
      expect(results[1].relevanceScore).toBeGreaterThanOrEqual(results[2].relevanceScore);
      // The cooking memory should have the lowest score (no overlap)
      expect(results[2].memories[0]).toContain('cooking');
    });

    it('should handle case-insensitive matching', async () => {
      const currentContext = 'JavaScript Programming';
      const memories: Memory[] = [
        {
          memories: ['javascript programming'],
          timestamp: new Date(),
          llm: 'test',
        },
      ];

      const results = await scorer.scoreRelevance(currentContext, memories);

      expect(results).toHaveLength(1);
      expect(results[0].relevanceScore).toBe(1.0);
    });

    it('should handle multiple memory strings in a single Memory object', async () => {
      const currentContext = 'web development';
      const memories: Memory[] = [
        {
          memories: ['web design', 'frontend development', 'backend development'],
          timestamp: new Date(),
          llm: 'test',
        },
      ];

      const results = await scorer.scoreRelevance(currentContext, memories);

      expect(results).toHaveLength(1);
      // Should consider all memory strings joined together
      expect(results[0].relevanceScore).toBeGreaterThan(0);
    });
  });

  describe('vectorUtils', () => {
    describe('cosineSimilarity', () => {
      it('should calculate cosine similarity correctly for identical vectors', () => {
        const a = [1, 2, 3];
        const b = [1, 2, 3];
        const similarity = cosineSimilarity(a, b);
        expect(similarity).toBe(1.0);
      });

      it('should calculate cosine similarity correctly for orthogonal vectors', () => {
        const a = [1, 0, 0];
        const b = [0, 1, 0];
        const similarity = cosineSimilarity(a, b);
        // Normalized to [0, 1], so -1 becomes 0, 0 becomes 0.5, 1 becomes 1
        expect(similarity).toBeCloseTo(0.5, 5);
      });

      it('should calculate cosine similarity correctly for opposite vectors', () => {
        const a = [1, 2, 3];
        const b = [-1, -2, -3];
        const similarity = cosineSimilarity(a, b);
        // Cosine of opposite vectors is -1, normalized to 0
        expect(similarity).toBeCloseTo(0, 5);
      });

      it('should handle zero vectors', () => {
        const a = [0, 0, 0];
        const b = [1, 2, 3];
        const similarity = cosineSimilarity(a, b);
        expect(similarity).toBe(0);
      });

      it('should throw error for vectors of different lengths', () => {
        const a = [1, 2, 3];
        const b = [1, 2];
        expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have the same length');
      });

      it('should handle empty vectors', () => {
        const a: number[] = [];
        const b: number[] = [];
        const similarity = cosineSimilarity(a, b);
        expect(similarity).toBe(0);
      });

      it('should calculate similarity for high-dimensional vectors', () => {
        const a = Array(384).fill(0.5);
        const b = Array(384).fill(0.5);
        const similarity = cosineSimilarity(a, b);
        expect(similarity).toBe(1.0);
      });
    });
  });
});
