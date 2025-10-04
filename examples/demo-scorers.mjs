#!/usr/bin/env node

/**
 * Example script demonstrating the modular relevance scoring system
 * This script shows how to use different scorers without MongoDB
 */

import { KeywordScorer } from '../build/scorers/KeywordScorer.js';
import { cosineSimilarity } from '../build/scorers/vectorUtils.js';

console.log('='.repeat(80));
console.log('Memory MCP - Modular Relevance Scoring Demo');
console.log('='.repeat(80));

// Sample memories
const memories = [
  {
    memories: ['JavaScript is a programming language used for web development'],
    timestamp: new Date('2024-01-01'),
    llm: 'test',
  },
  {
    memories: ['Python is excellent for data science and machine learning'],
    timestamp: new Date('2024-01-02'),
    llm: 'test',
  },
  {
    memories: ['I love cooking Italian food and making pasta from scratch'],
    timestamp: new Date('2024-01-03'),
    llm: 'test',
  },
  {
    memories: ['Web development frameworks like React and Vue are popular'],
    timestamp: new Date('2024-01-04'),
    llm: 'test',
  },
];

// Test query
const query = 'Tell me about programming languages for web development';

console.log('\n📝 Sample Memories:');
memories.forEach((m, i) => {
  console.log(`  ${i + 1}. ${m.memories[0]}`);
});

console.log(`\n🔍 Query: "${query}"\n`);

// Test Keyword Scorer
console.log('─'.repeat(80));
console.log('1️⃣  Keyword Scorer (Jaccard Similarity)');
console.log('─'.repeat(80));

const keywordScorer = new KeywordScorer();
const keywordResults = await keywordScorer.scoreRelevance(query, memories);

console.log('\nResults (sorted by relevance):');
keywordResults.forEach((result, i) => {
  const scoreBar = '█'.repeat(Math.round(result.relevanceScore * 20));
  console.log(
    `  ${i + 1}. [${scoreBar.padEnd(20, '░')}] ${result.relevanceScore.toFixed(3)} - ${result.memories[0].substring(0, 60)}...`
  );
});

// Test Vector Similarity
console.log('\n' + '─'.repeat(80));
console.log('2️⃣  Vector Similarity (Cosine Similarity Example)');
console.log('─'.repeat(80));

// Example vectors (in real SBERT, these would be 384-dimensional embeddings)
const vec1 = [1.0, 0.5, 0.2, 0.8, 0.3];
const vec2 = [0.9, 0.6, 0.3, 0.7, 0.4]; // Similar to vec1
const vec3 = [0.1, 0.2, 0.9, 0.1, 0.8]; // Different from vec1

console.log('\nExample 5D vectors:');
console.log('  vec1:', vec1);
console.log('  vec2:', vec2, '(similar to vec1)');
console.log('  vec3:', vec3, '(different from vec1)');

const sim12 = cosineSimilarity(vec1, vec2);
const sim13 = cosineSimilarity(vec1, vec3);

console.log('\nSimilarity scores:');
console.log(`  vec1 ↔ vec2: ${sim12.toFixed(4)} (high similarity)`);
console.log(`  vec1 ↔ vec3: ${sim13.toFixed(4)} (low similarity)`);

// Configuration info
console.log('\n' + '─'.repeat(80));
console.log('3️⃣  Configuration');
console.log('─'.repeat(80));

console.log('\nTo use different scoring strategies, set environment variables:');
console.log(`
  # Keyword Scorer (default, no setup needed)
  export RELEVANCE_SCORER_TYPE="keyword"

  # Sentence-BERT Scorer (requires SBERT service)
  export RELEVANCE_SCORER_TYPE="sbert"
  export SBERT_SERVICE_URL="http://localhost:5000/embed"
  export SBERT_MODEL="all-MiniLM-L6-v2"
`);

console.log('\n' + '='.repeat(80));
console.log('✅ Demo complete! See README.md for more details.');
console.log('='.repeat(80));
