import {
  sanitizeString,
  sanitizeObject,
  isValidUUID,
  isValidEmail,
  isValidUrl,
  generateRequestSignature,
  verifyRequestSignature,
} from '../middleware/security';
import { encryptionService } from '../services/encryptionService';

describe('Security Middleware', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should escape special characters', () => {
      const input = 'Test & <test> "quotes"';
      const result = sanitizeString(input);
      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&quot;');
    });

    it('should remove null bytes', () => {
      const input = 'Test\0String';
      const result = sanitizeString(input);
      expect(result).not.toContain('\0');
    });

    it('should trim whitespace', () => {
      const input = '  test  ';
      const result = sanitizeString(input);
      expect(result).toBe('test');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert(1)</script>',
        nested: {
          value: 'Test & Value',
        },
      };
      const result = sanitizeObject(input);
      expect(result.name).not.toContain('<script>');
      expect(result.nested.value).toContain('&amp;');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>test</script>', 'normal'];
      const result = sanitizeObject(input);
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('normal');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBeNull();
      expect(sanitizeObject(undefined)).toBeUndefined();
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('API Request Signing', () => {
    const secret = 'test-secret';
    const method = 'POST';
    const path = '/api/test';
    const body = { data: 'test' };
    const timestamp = Date.now();

    it('should generate consistent signatures', () => {
      const sig1 = generateRequestSignature(method, path, body, timestamp, secret);
      const sig2 = generateRequestSignature(method, path, body, timestamp, secret);
      expect(sig1).toBe(sig2);
    });

    it('should verify valid signatures', () => {
      const signature = generateRequestSignature(method, path, body, timestamp, secret);
      const isValid = verifyRequestSignature(method, path, body, timestamp, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const signature = 'invalid-signature';
      const isValid = verifyRequestSignature(method, path, body, timestamp, signature, secret);
      expect(isValid).toBe(false);
    });

    it('should reject tampered requests', () => {
      const signature = generateRequestSignature(method, path, body, timestamp, secret);
      const tamperedBody = { data: 'tampered' };
      const isValid = verifyRequestSignature(method, path, tamperedBody, timestamp, signature, secret);
      expect(isValid).toBe(false);
    });
  });
});

describe('Encryption Service', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt strings', () => {
      const plaintext = 'sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'test data';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should handle special characters', () => {
      const plaintext = 'Test with émojis 🔒 and spëcial çhars!';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptJSON and decryptJSON', () => {
    it('should encrypt and decrypt objects', () => {
      const obj = {
        name: 'John Doe',
        ssn: '123-45-6789',
        nested: {
          value: 'test',
        },
      };
      const encrypted = encryptionService.encryptJSON(obj);
      const decrypted = encryptionService.decryptJSON(encrypted);
      expect(decrypted).toEqual(obj);
    });
  });

  describe('hash', () => {
    it('should generate consistent hashes', () => {
      const data = 'password123';
      const hash1 = encryptionService.hash(data);
      const hash2 = encryptionService.hash(data);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = encryptionService.hash('password1');
      const hash2 = encryptionService.hash('password2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateToken', () => {
    it('should generate random tokens', () => {
      const token1 = encryptionService.generateToken(32);
      const token2 = encryptionService.generateToken(32);
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate tokens of specified length', () => {
      const token = encryptionService.generateToken(16);
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });
  });
});
