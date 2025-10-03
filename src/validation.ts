/**
 * Input validation utilities for user-provided content
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sanitize and validate text input
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string');
  }
  
  if (input.length > maxLength) {
    throw new ValidationError(`Input exceeds maximum length of ${maxLength} characters`);
  }
  
  return input.trim();
}

/**
 * Validate array of strings
 */
export function validateStringArray(arr: string[], maxLength: number = 10000, maxItems: number = 100): string[] {
  if (!Array.isArray(arr)) {
    throw new ValidationError('Input must be an array');
  }
  
  if (arr.length > maxItems) {
    throw new ValidationError(`Too many items (max ${maxItems})`);
  }
  
  return arr.map(item => sanitizeInput(item, maxLength));
}

/**
 * Validate tags array
 */
export function validateTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    throw new ValidationError('Tags must be an array');
  }
  
  if (tags.length > 50) {
    throw new ValidationError('Too many tags (max 50)');
  }
  
  tags.forEach(tag => {
    if (typeof tag !== 'string') {
      throw new ValidationError('Each tag must be a string');
    }
    if (tag.length > 100) {
      throw new ValidationError('Tag too long (max 100 characters)');
    }
  });
  
  return tags.map(tag => tag.trim());
}

/**
 * Validate conversation ID
 */
export function validateConversationId(id: string): string {
  if (typeof id !== 'string') {
    throw new ValidationError('Conversation ID must be a string');
  }
  
  if (id.length === 0) {
    throw new ValidationError('Conversation ID cannot be empty');
  }
  
  if (id.length > 256) {
    throw new ValidationError('Conversation ID too long (max 256 characters)');
  }
  
  return id.trim();
}

/**
 * Validate numeric range
 */
export function validateNumber(value: number, min: number, max: number, name: string): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${name} must be a valid number`);
  }
  
  if (value < min || value > max) {
    throw new ValidationError(`${name} must be between ${min} and ${max}`);
  }
  
  return value;
}
