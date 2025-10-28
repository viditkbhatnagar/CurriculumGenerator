import * as crypto from 'crypto';
import config from '../config';

/**
 * Encryption Service
 * Provides AES-256 encryption for sensitive data at rest
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

class EncryptionService {
  private encryptionKey: Buffer;

  constructor() {
    // Get encryption key from environment or generate one
    const keyString = config.encryption.key;
    
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Derive a 32-byte key from the provided key string
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  encrypt(plaintext: string): EncryptedData {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Generate random salt for additional security
      const salt = crypto.randomBytes(SALT_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
      
      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      
      // Create decipher
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.encryptionKey,
        Buffer.from(iv, 'hex')
      );
      
      // Set authentication tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data (one-way, for passwords, etc.)
   */
  hash(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt JSON object
   */
  encryptJSON(obj: any): EncryptedData {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to JSON object
   */
  decryptJSON(encryptedData: EncryptedData): any {
    const decrypted = this.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }
}

export const encryptionService = new EncryptionService();
