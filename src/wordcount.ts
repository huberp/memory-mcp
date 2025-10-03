/**
 * Word count utility with caching for improved performance.
 * Prevents recomputation of word counts for the same text.
 */

const wordCountCache = new Map<string, number>();
const MAX_CACHE_SIZE = 1000;

/**
 * Get word count of text with optional caching.
 * 
 * @param text - The text to count words in
 * @param useCache - Whether to use caching (default: true)
 * @returns The number of words in the text
 * 
 * @example
 * ```typescript
 * const count = getWordCount("Hello world");
 * console.log(count); // 2
 * ```
 */
export function getWordCount(text: string, useCache: boolean = true): number {
  if (useCache && wordCountCache.has(text)) {
    return wordCountCache.get(text)!;
  }
  
  const count = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  if (useCache && wordCountCache.size < MAX_CACHE_SIZE) {
    wordCountCache.set(text, count);
  }
  
  return count;
}

/**
 * Clear the word count cache.
 * Useful for testing or when memory needs to be freed.
 */
export function clearWordCountCache(): void {
  wordCountCache.clear();
}

/**
 * Get the current size of the word count cache.
 * 
 * @returns The number of entries in the cache
 */
export function getWordCountCacheSize(): number {
  return wordCountCache.size;
}
