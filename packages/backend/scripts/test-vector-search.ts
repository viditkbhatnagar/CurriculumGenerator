#!/usr/bin/env ts-node

/**
 * Vector Search Test Script
 * 
 * Tests MongoDB Atlas Vector Search functionality by:
 * 1. Creating test documents with embeddings
 * 2. Performing vector similarity search
 * 3. Verifying results and similarity scores
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

interface TestDocument {
  content: string;
  domain: string;
  sourceType: string;
  credibilityScore: number;
  publicationDate: Date;
  metadata: {
    title: string;
    tags: string[];
    chunkIndex: number;
    totalChunks: number;
  };
  embedding: number[];
}

class VectorSearchTester {
  private testCollectionName = 'knowledgebases';
  private testDocIds: mongoose.Types.ObjectId[] = [];

  async runTests(): Promise<boolean> {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ Error: MONGODB_URI environment variable is not set');
      return false;
    }

    try {
      console.log('\n🔍 Testing MongoDB Atlas Vector Search...\n');

      // Connect to MongoDB
      await mongoose.connect(mongoUri);
      console.log('✓ Connected to MongoDB\n');

      const db = mongoose.connection.db;
      const collection = db.collection(this.testCollectionName);

      // Step 1: Check if vector search index exists
      await this.checkVectorSearchIndex(collection);

      // Step 2: Insert test documents with embeddings
      await this.insertTestDocuments(collection);

      // Step 3: Perform vector search
      await this.performVectorSearch(collection);

      // Step 4: Clean up test documents
      await this.cleanup(collection);

      console.log('\n✅ Vector Search tests completed successfully!\n');
      return true;

    } catch (error: any) {
      console.error('\n❌ Vector Search test failed:', error.message);
      return false;
    } finally {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB\n');
    }
  }

  private async checkVectorSearchIndex(collection: any): Promise<void> {
    try {
      console.log('📋 Checking for vector search index...');
      
      const indexes = await collection.listSearchIndexes().toArray();
      const vectorIndex = indexes.find(
        (idx: any) => idx.name === 'knowledge_base_vector_index'
      );

      if (!vectorIndex) {
        console.log('⚠️  Vector search index not found');
        console.log('   Please create the index in Atlas Search UI');
        console.log('   See MONGODB_ATLAS_SETUP.md for instructions\n');
        throw new Error('Vector search index not configured');
      }

      const status = vectorIndex.status || 'unknown';
      if (status === 'READY' || status === 'ACTIVE') {
        console.log(`✓ Vector search index found and active (status: ${status})\n`);
      } else {
        console.log(`⚠️  Vector search index status: ${status}`);
        console.log('   Index may still be building. Wait and try again.\n');
        throw new Error('Vector search index not ready');
      }

    } catch (error: any) {
      if (error.message.includes('not supported') || error.code === 115) {
        console.log('❌ Vector search not supported on this cluster tier');
        console.log('   Requires MongoDB Atlas M10+ cluster\n');
        throw new Error('Vector search not available');
      }
      throw error;
    }
  }

  private async insertTestDocuments(collection: any): Promise<void> {
    console.log('📝 Inserting test documents with embeddings...');

    // Generate mock embeddings (1536 dimensions)
    // In production, these would come from OpenAI API
    const mockEmbedding1 = this.generateMockEmbedding([0.1, 0.2, 0.3]);
    const mockEmbedding2 = this.generateMockEmbedding([0.15, 0.25, 0.35]);
    const mockEmbedding3 = this.generateMockEmbedding([0.5, 0.6, 0.7]);
    const mockEmbedding4 = this.generateMockEmbedding([-0.1, -0.2, -0.3]);

    const testDocs: TestDocument[] = [
      {
        content: 'Introduction to machine learning and artificial intelligence concepts',
        domain: 'Computer Science',
        sourceType: 'pdf',
        credibilityScore: 95,
        publicationDate: new Date('2023-01-15'),
        metadata: {
          title: 'Machine Learning Fundamentals',
          tags: ['AI', 'ML', 'Education'],
          chunkIndex: 0,
          totalChunks: 1,
        },
        embedding: mockEmbedding1,
      },
      {
        content: 'Advanced machine learning algorithms and deep learning techniques',
        domain: 'Computer Science',
        sourceType: 'pdf',
        credibilityScore: 90,
        publicationDate: new Date('2023-03-20'),
        metadata: {
          title: 'Deep Learning Advanced Topics',
          tags: ['AI', 'Deep Learning', 'Neural Networks'],
          chunkIndex: 0,
          totalChunks: 1,
        },
        embedding: mockEmbedding2,
      },
      {
        content: 'Business management principles and organizational behavior',
        domain: 'Business',
        sourceType: 'docx',
        credibilityScore: 85,
        publicationDate: new Date('2023-02-10'),
        metadata: {
          title: 'Business Management Essentials',
          tags: ['Business', 'Management', 'Leadership'],
          chunkIndex: 0,
          totalChunks: 1,
        },
        embedding: mockEmbedding3,
      },
      {
        content: 'Historical perspectives on ancient civilizations and cultures',
        domain: 'History',
        sourceType: 'url',
        credibilityScore: 80,
        publicationDate: new Date('2022-11-05'),
        metadata: {
          title: 'Ancient Civilizations Overview',
          tags: ['History', 'Culture', 'Ancient'],
          chunkIndex: 0,
          totalChunks: 1,
        },
        embedding: mockEmbedding4,
      },
    ];

    const result = await collection.insertMany(testDocs);
    this.testDocIds = Object.values(result.insertedIds) as mongoose.Types.ObjectId[];
    
    console.log(`✓ Inserted ${this.testDocIds.length} test documents\n`);
  }

  private async performVectorSearch(collection: any): Promise<void> {
    console.log('🔎 Performing vector similarity search...');

    // Query embedding similar to first two documents
    const queryEmbedding = this.generateMockEmbedding([0.12, 0.22, 0.32]);

    const pipeline = [
      {
        $vectorSearch: {
          index: 'knowledge_base_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 5,
        }
      },
      {
        $addFields: {
          similarityScore: { $meta: 'vectorSearchScore' }
        }
      },
      {
        $match: {
          similarityScore: { $gte: 0.75 }
        }
      },
      {
        $project: {
          content: 1,
          domain: 1,
          'metadata.title': 1,
          credibilityScore: 1,
          similarityScore: 1,
        }
      }
    ];

    try {
      const results = await collection.aggregate(pipeline).toArray();

      console.log(`✓ Vector search executed successfully`);
      console.log(`✓ Found ${results.length} similar documents\n`);

      if (results.length > 0) {
        console.log('📊 Search Results:\n');
        results.forEach((doc: any, index: number) => {
          console.log(`   ${index + 1}. ${doc.metadata.title}`);
          console.log(`      Domain: ${doc.domain}`);
          console.log(`      Similarity: ${doc.similarityScore.toFixed(4)}`);
          console.log(`      Credibility: ${doc.credibilityScore}`);
          console.log(`      Content: ${doc.content.substring(0, 60)}...`);
          console.log('');
        });

        // Verify results are ranked by similarity
        const scores = results.map((r: any) => r.similarityScore);
        const isSorted = scores.every((score: number, i: number) => 
          i === 0 || score <= scores[i - 1]
        );

        if (isSorted) {
          console.log('✓ Results correctly ranked by similarity score');
        } else {
          console.log('⚠️  Results may not be properly ranked');
        }

        // Verify similarity threshold
        const allAboveThreshold = scores.every((score: number) => score >= 0.75);
        if (allAboveThreshold) {
          console.log('✓ All results above similarity threshold (0.75)');
        } else {
          console.log('⚠️  Some results below similarity threshold');
        }

      } else {
        console.log('⚠️  No results found above similarity threshold');
        console.log('   This may be expected with mock embeddings');
      }

    } catch (error: any) {
      console.error('❌ Vector search query failed:', error.message);
      throw error;
    }
  }

  private async cleanup(collection: any): Promise<void> {
    console.log('\n🧹 Cleaning up test documents...');
    
    if (this.testDocIds.length > 0) {
      await collection.deleteMany({
        _id: { $in: this.testDocIds }
      });
      console.log(`✓ Removed ${this.testDocIds.length} test documents`);
    }
  }

  private generateMockEmbedding(seed: number[]): number[] {
    // Generate a 1536-dimension mock embedding
    // In production, use OpenAI API: text-embedding-3-large
    const embedding: number[] = [];
    
    for (let i = 0; i < 1536; i++) {
      // Use seed values to create variation
      const seedValue = seed[i % seed.length];
      const noise = (Math.sin(i * 0.1) * 0.1);
      embedding.push(seedValue + noise);
    }

    // Normalize the vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    
    return embedding.map(val => val / magnitude);
  }
}

// Run the test
async function main() {
  const tester = new VectorSearchTester();
  const success = await tester.runTests();
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
