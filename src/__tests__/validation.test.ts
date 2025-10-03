import { describe, it, expect } from '@jest/globals';
import {
  sanitizeInput,
  validateStringArray,
  validateTags,
  validateConversationId,
  validateNumber,
  ValidationError,
} from '../validation.js';

describe('Validation Utilities', () => {
  describe('sanitizeInput', () => {
    it('should trim whitespace from input', () => {
      expect(sanitizeInput('  hello world  ')).toBe('hello world');
    });

    it('should accept valid strings', () => {
      expect(sanitizeInput('valid input')).toBe('valid input');
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeInput(123 as any)).toThrow(ValidationError);
      expect(() => sanitizeInput(123 as any)).toThrow('Input must be a string');
    });

    it('should throw error for input exceeding max length', () => {
      const longString = 'a'.repeat(10001);
      expect(() => sanitizeInput(longString)).toThrow(ValidationError);
      expect(() => sanitizeInput(longString)).toThrow('Input exceeds maximum length');
    });

    it('should accept input with custom max length', () => {
      const str = 'a'.repeat(50);
      expect(() => sanitizeInput(str, 100)).not.toThrow();
      expect(() => sanitizeInput(str, 40)).toThrow(ValidationError);
    });
  });

  describe('validateStringArray', () => {
    it('should validate and sanitize array of strings', () => {
      const result = validateStringArray(['  one  ', '  two  ']);
      expect(result).toEqual(['one', 'two']);
    });

    it('should throw error for non-array input', () => {
      expect(() => validateStringArray('not an array' as any)).toThrow(ValidationError);
      expect(() => validateStringArray('not an array' as any)).toThrow('Input must be an array');
    });

    it('should throw error for too many items', () => {
      const largeArray = new Array(101).fill('item');
      expect(() => validateStringArray(largeArray)).toThrow(ValidationError);
      expect(() => validateStringArray(largeArray)).toThrow('Too many items');
    });

    it('should accept custom max items', () => {
      const array = ['a', 'b', 'c'];
      expect(() => validateStringArray(array, 10000, 5)).not.toThrow();
      expect(() => validateStringArray(array, 10000, 2)).toThrow(ValidationError);
    });
  });

  describe('validateTags', () => {
    it('should validate and trim tags', () => {
      const result = validateTags(['  tag1  ', '  tag2  ']);
      expect(result).toEqual(['tag1', 'tag2']);
    });

    it('should throw error for non-array input', () => {
      expect(() => validateTags('not an array' as any)).toThrow(ValidationError);
      expect(() => validateTags('not an array' as any)).toThrow('Tags must be an array');
    });

    it('should throw error for too many tags', () => {
      const tooManyTags = new Array(51).fill('tag');
      expect(() => validateTags(tooManyTags)).toThrow(ValidationError);
      expect(() => validateTags(tooManyTags)).toThrow('Too many tags');
    });

    it('should throw error for non-string tags', () => {
      expect(() => validateTags([123 as any])).toThrow(ValidationError);
      expect(() => validateTags([123 as any])).toThrow('Each tag must be a string');
    });

    it('should throw error for tags exceeding max length', () => {
      const longTag = 'a'.repeat(101);
      expect(() => validateTags([longTag])).toThrow(ValidationError);
      expect(() => validateTags([longTag])).toThrow('Tag too long');
    });
  });

  describe('validateConversationId', () => {
    it('should trim and return valid conversation ID', () => {
      expect(validateConversationId('  conv-123  ')).toBe('conv-123');
    });

    it('should throw error for non-string input', () => {
      expect(() => validateConversationId(123 as any)).toThrow(ValidationError);
      expect(() => validateConversationId(123 as any)).toThrow('Conversation ID must be a string');
    });

    it('should throw error for empty string', () => {
      expect(() => validateConversationId('')).toThrow(ValidationError);
      expect(() => validateConversationId('')).toThrow('Conversation ID cannot be empty');
    });

    it('should throw error for ID exceeding max length', () => {
      const longId = 'a'.repeat(257);
      expect(() => validateConversationId(longId)).toThrow(ValidationError);
      expect(() => validateConversationId(longId)).toThrow('Conversation ID too long');
    });
  });

  describe('validateNumber', () => {
    it('should accept valid numbers in range', () => {
      expect(validateNumber(5, 0, 10, 'test')).toBe(5);
      expect(validateNumber(0, 0, 10, 'test')).toBe(0);
      expect(validateNumber(10, 0, 10, 'test')).toBe(10);
    });

    it('should throw error for non-number input', () => {
      expect(() => validateNumber('5' as any, 0, 10, 'test')).toThrow(ValidationError);
      expect(() => validateNumber('5' as any, 0, 10, 'test')).toThrow('test must be a valid number');
    });

    it('should throw error for NaN', () => {
      expect(() => validateNumber(NaN, 0, 10, 'test')).toThrow(ValidationError);
    });

    it('should throw error for numbers out of range', () => {
      expect(() => validateNumber(-1, 0, 10, 'test')).toThrow(ValidationError);
      expect(() => validateNumber(11, 0, 10, 'test')).toThrow(ValidationError);
      expect(() => validateNumber(11, 0, 10, 'test')).toThrow('test must be between 0 and 10');
    });
  });
});
