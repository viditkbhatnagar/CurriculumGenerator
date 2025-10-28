/**
 * MongoDB Initialization Script
 * 
 * This script initializes the MongoDB connection and ensures all indexes are created.
 * Run this script before starting the application for the first time.
 */

import { mongodb } from './mongodb';
import * as models from '../models';

async function initializeMongoDB() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongodb.connect();
    console.log('✅ MongoDB connected successfully');

    console.log('\n🔄 Creating indexes...');
    
    // Get all model names
    const modelNames = Object.keys(models).filter(key => 
      key !== 'default' && !key.startsWith('I')
    );

    // Ensure indexes for all models
    for (const modelName of modelNames) {
      const model = (models as any)[modelName];
      if (model && typeof model.createIndexes === 'function') {
        console.log(`  Creating indexes for ${modelName}...`);
        await model.createIndexes();
        console.log(`  ✅ ${modelName} indexes created`);
      }
    }

    console.log('\n✅ All indexes created successfully');

    // Display connection stats
    const stats = mongodb.getStats();
    console.log('\n📊 MongoDB Connection Stats:');
    console.log(`  Host: ${stats?.host}`);
    console.log(`  Database: ${stats?.name}`);
    console.log(`  Collections: ${stats?.collections.length}`);
    console.log(`  Ready State: ${stats?.readyState === 1 ? 'Connected' : 'Not Connected'}`);

    console.log('\n✅ MongoDB initialization complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Create vector search index in MongoDB Atlas for KnowledgeBase collection');
    console.log('  2. See packages/backend/src/models/README.md for instructions');
    console.log('  3. Start your application with: npm run dev');

  } catch (error) {
    console.error('❌ MongoDB initialization failed:', error);
    process.exit(1);
  } finally {
    await mongodb.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  initializeMongoDB();
}

export default initializeMongoDB;
