/**
 * Document Ingestion Service Tests
 * Tests for document extraction and text cleaning
 */

import { documentIngestionService } from '../services/documentIngestionService';
import { DocumentSource } from '../types/knowledgeBase';

describe('DocumentIngestionService', () => {
  describe('cleanText', () => {
    it('should normalize whitespace', () => {
      const service = documentIngestionService as any;
      const input = 'This  has   multiple    spaces';
      const result = service.cleanText(input);
      
      expect(result).toBe('This has multiple spaces');
    });

    it('should remove excessive line breaks', () => {
      const service = documentIngestionService as any;
      const input = 'Line 1\n\n\n\n\nLine 2';
      const result = service.cleanText(input);
      
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should trim leading and trailing whitespace', () => {
      const service = documentIngestionService as any;
      const input = '   Text with spaces   \n\n';
      const result = service.cleanText(input);
      
      expect(result).toBe('Text with spaces');
    });

    it('should remove control characters', () => {
      const service = documentIngestionService as any;
      const input = 'Text\x00with\x01control\x02chars';
      const result = service.cleanText(input);
      
      expect(result).not.toContain('\x00');
      expect(result).not.toContain('\x01');
      expect(result).not.toContain('\x02');
    });

    it('should preserve basic punctuation', () => {
      const service = documentIngestionService as any;
      const input = 'Hello, world! How are you? I\'m fine.';
      const result = service.cleanText(input);
      
      expect(result).toContain(',');
      expect(result).toContain('!');
      expect(result).toContain('?');
      expect(result).toContain('\'');
      expect(result).toContain('.');
    });
  });

  describe('processDocument', () => {
    it('should throw error for unsupported document type', async () => {
      const source: DocumentSource = {
        type: 'invalid' as any,
        content: 'test',
        metadata: {
          title: 'Test',
          publicationDate: new Date(),
          domain: 'test',
          credibilityScore: 80,
          tags: [],
        },
      };

      await expect(documentIngestionService.processDocument(source)).rejects.toThrow(
        'Unsupported document type'
      );
    });
  });

  describe('enforceRateLimit', () => {
    it('should delay subsequent requests', async () => {
      const service = documentIngestionService as any;
      
      const start = Date.now();
      await service.enforceRateLimit();
      await service.enforceRateLimit();
      const elapsed = Date.now() - start;
      
      // Should have waited at least 1 second between requests
      expect(elapsed).toBeGreaterThanOrEqual(900); // Allow 100ms tolerance
    });
  });

  describe('processDocuments batch', () => {
    it('should continue processing after individual failures', async () => {
      const sources: DocumentSource[] = [
        {
          type: 'invalid' as any,
          content: 'test1',
          metadata: {
            title: 'Test 1',
            publicationDate: new Date(),
            domain: 'test',
            credibilityScore: 80,
            tags: [],
          },
        },
        {
          type: 'invalid' as any,
          content: 'test2',
          metadata: {
            title: 'Test 2',
            publicationDate: new Date(),
            domain: 'test',
            credibilityScore: 80,
            tags: [],
          },
        },
      ];

      const results = await documentIngestionService.processDocuments(sources);
      
      // Should return empty array as all failed but didn't throw
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
