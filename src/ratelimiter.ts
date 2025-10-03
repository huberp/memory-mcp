/**
 * Simple rate limiter for request throttling.
 * Prevents abuse by limiting requests per time window.
 */

export class RateLimiter {
  private requests = new Map<string, number[]>();
  
  constructor(
    private maxRequests = 100,
    private windowMs = 60000 // 1 minute
  ) {}
  
  /**
   * Check if a request is allowed for the given key.
   * 
   * @param key - Identifier for the rate limit (e.g., userId or llm)
   * @returns true if request is allowed, false if rate limit exceeded
   * 
   * @example
   * ```typescript
   * const limiter = new RateLimiter(10, 60000); // 10 requests per minute
   * if (limiter.isAllowed('user-123')) {
   *   // Process request
   * } else {
   *   // Reject request
   * }
   * ```
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get recent requests
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add new request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    // Clean up old entries periodically
    if (this.requests.size > 1000) {
      this.cleanup(windowStart);
    }
    
    return true;
  }
  
  /**
   * Clean up old request records to prevent memory leaks.
   */
  private cleanup(windowStart: number): void {
    for (const [key, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => time > windowStart);
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
  }
  
  /**
   * Get the number of requests remaining for a key.
   * 
   * @param key - Identifier for the rate limit
   * @returns Number of requests remaining in the current window
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
  
  /**
   * Clear all rate limit records.
   * Useful for testing or when resetting limits.
   */
  clear(): void {
    this.requests.clear();
  }
}

// Create default rate limiter instances for different tools
export const writeRateLimiter = new RateLimiter(50, 60000); // 50 writes per minute
export const readRateLimiter = new RateLimiter(100, 60000); // 100 reads per minute
