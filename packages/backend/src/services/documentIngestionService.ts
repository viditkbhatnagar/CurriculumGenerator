const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { DocumentSource, ProcessedDocument, IngestionResult } from '../types/knowledgeBase';

/**
 * Document Ingestion Service
 * Handles extraction and preprocessing of text from PDF, DOCX, and URL sources
 */
export class DocumentIngestionService {
  private readonly rateLimitDelay = 1000; // 1 second between URL requests
  private lastRequestTime = 0;

  /**
   * Process a document source and extract text
   */
  async processDocument(source: DocumentSource): Promise<ProcessedDocument> {
    let extractedText: string;

    switch (source.type) {
      case 'pdf':
        extractedText = await this.extractFromPDF(source.content as Buffer);
        break;
      case 'docx':
        extractedText = await this.extractFromDOCX(source.content as Buffer);
        break;
      case 'url':
        extractedText = await this.extractFromURL(source.content as string);
        break;
      default:
        throw new Error(`Unsupported document type: ${source.type}`);
    }

    const cleanedText = this.cleanText(extractedText);

    return {
      text: extractedText,
      metadata: source.metadata,
      cleanedText,
    };
  }

  /**
   * Extract text from PDF using pdf-parse
   */
  private async extractFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from DOCX using mammoth
   */
  private async extractFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from URL with rate limiting
   */
  private async extractFromURL(url: string): Promise<string> {
    // Implement rate limiting
    await this.enforceRateLimit();

    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'AGCQ-Curriculum-Generator/1.0',
        },
      });

      const $ = cheerio.load(response.data);

      // Remove script, style, and navigation elements
      $('script, style, nav, header, footer, aside').remove();

      // Extract text from main content areas
      const mainContent = $('main, article, .content, #content, body').first();
      const text = mainContent.length > 0 ? mainContent.text() : $('body').text();

      return text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
      }
      throw new Error(`Failed to extract text from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enforce rate limiting for URL requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Clean and preprocess extracted text
   * - Remove special characters (except basic punctuation)
   * - Normalize whitespace
   * - Remove excessive line breaks
   */
  private cleanText(text: string): string {
    let cleaned = text;

    // Normalize unicode characters
    cleaned = cleaned.normalize('NFKD');

    // Remove control characters except newlines and tabs
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Replace multiple spaces with single space
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    // Replace multiple newlines with double newline (paragraph break)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove leading/trailing whitespace from each line
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .join('\n');

    // Remove empty lines at start and end
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Batch process multiple documents
   */
  async processDocuments(sources: DocumentSource[]): Promise<ProcessedDocument[]> {
    const results: ProcessedDocument[] = [];

    for (const source of sources) {
      try {
        const processed = await this.processDocument(source);
        results.push(processed);
      } catch (error) {
        console.error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue processing other documents
      }
    }

    return results;
  }
}

export const documentIngestionService = new DocumentIngestionService();
