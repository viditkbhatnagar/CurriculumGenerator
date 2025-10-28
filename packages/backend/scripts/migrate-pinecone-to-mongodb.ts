/**
 * Migration Script: Pinecone to MongoDB Atlas Vector Search
 * 
 * This script exports embeddings from Pinecone and imports them into MongoDB
 * Implements Requirement 2.1, 2.3
 * 
 * Usage:
 *   npm run ts-node scripts/migrate-pinecone-to-mongodb.ts
 */

import { Pinecone } from '@pinecone-database/pinecone';
import mongoose from 'mongoose';
import { KnowledgeBase } from '../src/models/KnowledgeBase';
import dotenv from 'dotenv';

dotenv.config();

interface PineconeVector {
  id: string;
  values: number[];
  metadata: {
    content: string;
    source_url?: string;
    source_type: string;
    publication_date: string;
    domain: string;
    credibility_score: number;
    title?: string;
    author?: string;
    tags?: string[];
    chunk_index: number;
    total_chunks: number;
  };
}

class PineconeToMongoDBMigration {
  private pinecone: Pinecone | null = null;
  private indexName: string;
  private batchSize = 100;

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || 'curriculum-knowledge-base';
  }

  /**
   * Initialize Pinecone connection
   */
  private async initializePinecone(): Promise<void> {
    const apiKey = process.env.PINECONE_API_KEY;

    if (!apiKey || apiKey === 'dummy-key-for-dev' || apiKey === 'your-pinecone-api-key') {
      console.log('⚠️  Pinecone API key not configured - skipping Pinecone export');
      return;
    }

    try {
      this.pinecone = new Pinecone({ apiKey });
      console.log('✓ Pinecone initialized');
    } catch (error) {
      console.error('Failed to initialize Pinecone:', error);
      throw error;
    }
  }

  /**
   * Initialize MongoDB connection
   */
  private async initializeMongoDB(): Promise<void> {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    try {
      await mongoose.connect(mongoUri);
      console.log('✓ MongoDB connected');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Export all vectors from Pinecone
   */
  private async exportFromPinecone(): Promise<PineconeVector[]> {
    if (!this.pinecone) {
      console.log('⚠️  Pinecone not initialized - no data to export');
      return [];
    }

    try {
      const index = this.pinecone.index(this.indexName);
      const vectors: PineconeVector[] = [];

      console.log('📤 Exporting vectors from Pinecone...');

      // Get index stats to know how many vectors exist
      const stats = await index.describeIndexStats();
      const totalVectors = stats.totalRecordCount || 0;

      console.log(`   Found ${totalVectors} vectors in Pinecone`);

      if (totalVectors === 0) {
        console.log('   No vectors to export');
        return [];
      }

      // Fetch vectors using query with dummy vector
      // Note: Pinecone doesn't have a direct "list all" API, so we use query
      // This is a simplified approach - in production, you might need pagination
      const dummyVector = new Array(1536).fill(0);
      const queryResponse = await index.query({
        vector: dummyVector,
        topK: 10000, // Adjust based on your data size
        includeMetadata: true,
        includeValues: true,
      });

      for (const match of queryResponse.matches) {
        if (match.values && match.metadata) {
          vectors.push({
            id: match.id,
            values: match.values,
            metadata: match.metadata as any,
          });
        }
      }

      console.log(`✓ Exported ${vectors.length} vectors from Pinecone`);
      return vectors;
    } catch (error) {
      console.error('Failed to export from Pinecone:', error);
      throw error;
    }
  }

  /**
   * Transform Pinecone vector to MongoDB document format
   */
  private transformVector(vector: PineconeVector): any {
    return {
      content: vector.metadata.content,
      sourceUrl: vector.metadata.source_url,
      sourceType: vector.metadata.source_type as 'pdf' | 'docx' | 'url' | 'manual',
      publicationDate: vector.metadata.publication_date
        ? new Date(vector.metadata.publication_date)
        : undefined,
      domain: vector.metadata.domain,
      credibilityScore: vector.metadata.credibility_score,
      metadata: {
        title: vector.metadata.title,
        author: vector.metadata.author,
        tags: vector.metadata.tags || [],
        chunkIndex: vector.metadata.chunk_index,
        totalChunks: vector.metadata.total_chunks,
      },
      embedding: vector.values,
    };
  }

  /**
   * Import vectors into MongoDB
   */
  private async importToMongoDB(vectors: PineconeVector[]): Promise<void> {
    if (vectors.length === 0) {
      console.log('⚠️  No vectors to import');
      return;
    }

    console.log('📥 Importing vectors to MongoDB...');

    try {
      // Clear existing data (optional - comment out if you want to keep existing data)
      const existingCount = await KnowledgeBase.countDocuments();
      if (existingCount > 0) {
        console.log(`   Found ${existingCount} existing documents in MongoDB`);
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          readline.question('   Clear existing data? (yes/no): ', resolve);
        });
        readline.close();

        if (answer.toLowerCase() === 'yes') {
          await KnowledgeBase.deleteMany({});
          console.log('   ✓ Cleared existing data');
        }
      }

      // Import in batches
      let imported = 0;
      for (let i = 0; i < vectors.length; i += this.batchSize) {
        const batch = vectors.slice(i, i + this.batchSize);
        const documents = batch.map((v) => this.transformVector(v));

        await KnowledgeBase.insertMany(documents, { ordered: false });
        imported += batch.length;

        console.log(`   Progress: ${imported}/${vectors.length} vectors imported`);
      }

      console.log(`✓ Successfully imported ${imported} vectors to MongoDB`);
    } catch (error) {
      console.error('Failed to import to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Verify the migration
   */
  private async verifyMigration(originalCount: number): Promise<void> {
    console.log('🔍 Verifying migration...');

    try {
      const mongoCount = await KnowledgeBase.countDocuments();
      console.log(`   MongoDB documents: ${mongoCount}`);
      console.log(`   Original Pinecone vectors: ${originalCount}`);

      if (mongoCount === originalCount) {
        console.log('✓ Migration verified - counts match');
      } else {
        console.warn('⚠️  Warning: Document counts do not match');
      }

      // Test a sample vector search
      const sampleDoc = await KnowledgeBase.findOne();
      if (sampleDoc) {
        console.log('✓ Sample document retrieved successfully');
        console.log(`   Domain: ${sampleDoc.domain}`);
        console.log(`   Embedding dimensions: ${sampleDoc.embedding.length}`);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      throw error;
    }
  }

  /**
   * Run the complete migration
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Pinecone to MongoDB migration...\n');

    try {
      // Step 1: Initialize connections
      await this.initializePinecone();
      await this.initializeMongoDB();

      // Step 2: Export from Pinecone
      const vectors = await this.exportFromPinecone();

      if (vectors.length === 0) {
        console.log('\n✓ Migration complete - no data to migrate');
        return;
      }

      // Step 3: Import to MongoDB
      await this.importToMongoDB(vectors);

      // Step 4: Verify migration
      await this.verifyMigration(vectors.length);

      console.log('\n✅ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Create vector search index in MongoDB Atlas');
      console.log('2. Test vector search functionality');
      console.log('3. Update application to use MongoDB vector search');
      console.log('4. Remove Pinecone dependencies');
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    } finally {
      await mongoose.disconnect();
      console.log('\n✓ MongoDB disconnected');
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  const migration = new PineconeToMongoDBMigration();
  migration
    .run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

export default PineconeToMongoDBMigration;
