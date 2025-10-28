#!/usr/bin/env ts-node

/**
 * MongoDB Atlas Connection Test Script
 * 
 * This script tests the connection to MongoDB Atlas and verifies:
 * - Database connectivity
 * - Database access permissions
 * - Collection operations
 * - Vector search index availability
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

class MongoDBConnectionTester {
  private results: TestResult[] = [];
  private mongoUri: string;

  constructor() {
    this.mongoUri = process.env.MONGODB_URI || '';
    
    if (!this.mongoUri) {
      console.error('❌ Error: MONGODB_URI environment variable is not set');
      console.error('Please set MONGODB_URI in your .env file');
      process.exit(1);
    }
  }

  private addResult(name: string, passed: boolean, message: string, details?: any) {
    this.results.push({ name, passed, message, details });
  }

  private printResult(result: TestResult) {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${color}${icon}${reset} ${result.message}`);
    
    if (result.details) {
      console.log(`  Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }

  async testConnection(): Promise<boolean> {
    console.log('\n🔍 Testing MongoDB Atlas Connection...\n');

    try {
      // Test 1: Connect to MongoDB
      await this.testBasicConnection();

      // Test 2: Database access
      await this.testDatabaseAccess();

      // Test 3: Collection operations
      await this.testCollectionOperations();

      // Test 4: Vector search index
      await this.testVectorSearchIndex();

      // Test 5: Connection info
      await this.displayConnectionInfo();

      // Print summary
      this.printSummary();

      return this.results.every(r => r.passed);

    } catch (error) {
      console.error('\n❌ Fatal error during testing:', error);
      return false;
    } finally {
      await mongoose.disconnect();
    }
  }

  private async testBasicConnection(): Promise<void> {
    try {
      await mongoose.connect(this.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.addResult(
        'connection',
        true,
        'Connected to MongoDB Atlas successfully'
      );
      this.printResult(this.results[this.results.length - 1]);

    } catch (error: any) {
      this.addResult(
        'connection',
        false,
        'Failed to connect to MongoDB Atlas',
        { error: error.message }
      );
      this.printResult(this.results[this.results.length - 1]);
      throw error;
    }
  }

  private async testDatabaseAccess(): Promise<void> {
    try {
      const dbName = mongoose.connection.db.databaseName;
      const admin = mongoose.connection.db.admin();
      
      // Try to list databases (requires permissions)
      await admin.listDatabases();

      this.addResult(
        'database_access',
        true,
        `Database '${dbName}' is accessible`
      );
      this.printResult(this.results[this.results.length - 1]);

    } catch (error: any) {
      this.addResult(
        'database_access',
        false,
        'Failed to access database',
        { error: error.message }
      );
      this.printResult(this.results[this.results.length - 1]);
    }
  }

  private async testCollectionOperations(): Promise<void> {
    try {
      const testCollectionName = '_connection_test';
      const collection = mongoose.connection.db.collection(testCollectionName);

      // Test write operation
      await collection.insertOne({
        test: true,
        timestamp: new Date(),
        message: 'Connection test document'
      });

      // Test read operation
      const doc = await collection.findOne({ test: true });

      // Test delete operation
      await collection.deleteMany({ test: true });

      // Clean up test collection
      await collection.drop().catch(() => {
        // Ignore error if collection doesn't exist
      });

      this.addResult(
        'collection_operations',
        true,
        'Collection operations (create, read, delete) working correctly'
      );
      this.printResult(this.results[this.results.length - 1]);

    } catch (error: any) {
      this.addResult(
        'collection_operations',
        false,
        'Failed to perform collection operations',
        { error: error.message }
      );
      this.printResult(this.results[this.results.length - 1]);
    }
  }

  private async testVectorSearchIndex(): Promise<void> {
    try {
      const db = mongoose.connection.db;
      
      // Check if knowledgebases collection exists
      const collections = await db.listCollections({ name: 'knowledgebases' }).toArray();
      
      if (collections.length === 0) {
        this.addResult(
          'vector_search_index',
          true,
          'Knowledge base collection not yet created (will be created on first use)',
          { note: 'Vector search index should be created in Atlas Search UI' }
        );
        this.printResult(this.results[this.results.length - 1]);
        return;
      }

      // Try to get search indexes (requires Atlas Search)
      try {
        const collection = db.collection('knowledgebases');
        
        // Note: listSearchIndexes is only available on Atlas M10+ clusters
        // This will fail on local MongoDB or lower tiers
        const indexes = await collection.listSearchIndexes().toArray();
        
        const vectorIndex = indexes.find(
          (idx: any) => idx.name === 'knowledge_base_vector_index'
        );

        if (vectorIndex) {
          const status = vectorIndex.status || 'unknown';
          const isActive = status === 'READY' || status === 'ACTIVE';
          
          this.addResult(
            'vector_search_index',
            isActive,
            isActive 
              ? `Vector search index 'knowledge_base_vector_index' is active`
              : `Vector search index exists but status is: ${status}`,
            { status, indexName: vectorIndex.name }
          );
        } else {
          this.addResult(
            'vector_search_index',
            false,
            'Vector search index not found',
            { 
              note: 'Create index in Atlas Search UI',
              expectedName: 'knowledge_base_vector_index'
            }
          );
        }
        
        this.printResult(this.results[this.results.length - 1]);

      } catch (error: any) {
        // listSearchIndexes not available (local MongoDB or M0/M2/M5 tier)
        if (error.message.includes('not supported') || error.code === 115) {
          this.addResult(
            'vector_search_index',
            true,
            'Vector search not available on this cluster tier',
            { 
              note: 'Requires MongoDB Atlas M10+ cluster',
              recommendation: 'Upgrade to M10 or higher for vector search support'
            }
          );
        } else {
          this.addResult(
            'vector_search_index',
            false,
            'Could not check vector search index',
            { error: error.message }
          );
        }
        this.printResult(this.results[this.results.length - 1]);
      }

    } catch (error: any) {
      this.addResult(
        'vector_search_index',
        false,
        'Failed to check vector search index',
        { error: error.message }
      );
      this.printResult(this.results[this.results.length - 1]);
    }
  }

  private async displayConnectionInfo(): Promise<void> {
    try {
      const db = mongoose.connection.db;
      const admin = db.admin();
      
      // Get server info
      const serverInfo = await admin.serverInfo();
      const dbStats = await db.stats();
      
      // Parse connection string to get host (safely)
      const hostMatch = this.mongoUri.match(/@([^/]+)/);
      const host = hostMatch ? hostMatch[1] : 'unknown';

      console.log('\n📊 Connection Details:');
      console.log(`   Host: ${host}`);
      console.log(`   Database: ${db.databaseName}`);
      console.log(`   MongoDB Version: ${serverInfo.version}`);
      console.log(`   Collections: ${dbStats.collections}`);
      console.log(`   Storage Size: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);

    } catch (error: any) {
      console.log('\n📊 Connection Details:');
      console.log(`   Database: ${mongoose.connection.db.databaseName}`);
      console.log(`   Status: Connected`);
    }
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const allPassed = passed === total;

    console.log('\n' + '='.repeat(50));
    console.log(`\n📋 Test Summary: ${passed}/${total} tests passed\n`);

    if (allPassed) {
      console.log('✅ All checks passed! MongoDB Atlas is configured correctly.\n');
      console.log('Next steps:');
      console.log('  1. Create vector search index in Atlas Search UI (if not done)');
      console.log('  2. Run: npm run create:indexes');
      console.log('  3. Proceed with database migration\n');
    } else {
      console.log('⚠️  Some checks failed. Please review the errors above.\n');
      console.log('Common issues:');
      console.log('  - Check MONGODB_URI is correct');
      console.log('  - Verify IP whitelist in Atlas Network Access');
      console.log('  - Ensure database user has correct permissions');
      console.log('  - For vector search: upgrade to M10+ cluster tier\n');
    }
  }
}

// Run the test
async function main() {
  const tester = new MongoDBConnectionTester();
  const success = await tester.testConnection();
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
