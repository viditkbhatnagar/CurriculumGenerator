#!/usr/bin/env node

/**
 * Test Analytics Storage
 * Makes a test AI API call to verify analytics are being stored
 */

require('dotenv').config();

// Import OpenAI service (adjust path as needed)
const mongoose = require('mongoose');

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/curriculum_db';

async function testAnalyticsStorage() {
  console.log('\n🧪 Testing Analytics Storage\n');
  console.log('='.repeat(60));

  try {
    // Connect to MongoDB
    console.log('\n1. Connecting to MongoDB...');
    await mongoose.connect(MONGO_URL);
    console.log('✅ Connected to MongoDB');

    // Import services after connection
    const { openaiService } = require('./src/services/openaiService');
    const { analyticsStorageService } = require('./src/services/analyticsStorageService');

    // Check analytics before test
    console.log('\n2. Checking analytics before test...');
    const beforeCount = await mongoose.connection.db
      .collection('analyticsmetrics')
      .countDocuments();
    console.log(`   Current analytics records: ${beforeCount}`);

    // Make a small test API call (generate embedding for test text)
    console.log('\n3. Making test AI API call...');
    console.log('   (Generating embedding for test text)');

    const testText = 'This is a test sentence for analytics tracking.';
    const startTime = Date.now();

    try {
      const embedding = await openaiService.generateEmbedding(testText);
      const duration = Date.now() - startTime;

      console.log(`✅ AI API call successful (${duration}ms)`);
      console.log(`   Embedding dimensions: ${embedding.length}`);
    } catch (error) {
      console.error('❌ AI API call failed:', error.message);
      console.log('\n⚠️  This might be due to:');
      console.log('   - Missing OPENAI_API_KEY in .env');
      console.log('   - Network connectivity issues');
      console.log('   - OpenAI service issues');

      // Check if we need API key
      if (!process.env.OPENAI_API_KEY) {
        console.log('\n💡 To enable AI API calls:');
        console.log('   1. Add OPENAI_API_KEY to packages/backend/.env');
        console.log('   2. Run: npm run dev');
        console.log('   3. Create a curriculum project to trigger real API calls');
      }
    }

    // Wait a moment for async storage to complete
    console.log('\n4. Waiting for analytics to be stored...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check analytics after test
    console.log('\n5. Checking analytics after test...');
    const afterCount = await mongoose.connection.db.collection('analyticsmetrics').countDocuments();
    console.log(`   Analytics records now: ${afterCount}`);

    if (afterCount > beforeCount) {
      console.log(`✅ SUCCESS! ${afterCount - beforeCount} new analytics records created`);

      // Show the new records
      const newRecords = await mongoose.connection.db
        .collection('analyticsmetrics')
        .find()
        .sort({ recordedAt: -1 })
        .limit(5)
        .toArray();

      console.log('\n📊 Recent Analytics Records:');
      newRecords.forEach((record, i) => {
        console.log(`\n   Record ${i + 1}:`);
        console.log(`     Type: ${record.metricType}`);
        console.log(`     Provider: ${record.provider}`);
        console.log(`     Model: ${record.model}`);
        if (record.tokensUsed) console.log(`     Tokens: ${record.tokensUsed}`);
        if (record.cost) console.log(`     Cost: $${record.cost.toFixed(6)}`);
        console.log(`     Recorded: ${record.recordedAt.toISOString()}`);
      });

      // Test querying analytics
      console.log('\n6. Testing analytics queries...');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const totalCost = await analyticsStorageService.getTotalCost(thirtyDaysAgo);
      const totalTokens = await analyticsStorageService.getTotalTokens(thirtyDaysAgo);

      console.log(`   Total Cost (30 days): $${totalCost.toFixed(6)}`);
      console.log(`   Total Tokens (30 days): ${totalTokens}`);

      console.log('\n✅ Analytics storage is working correctly!');
    } else {
      console.log('⚠️  No new analytics records created');
      console.log('   This could mean:');
      console.log('   - AI API call was not made (check for errors above)');
      console.log('   - Analytics storage is not being triggered');
      console.log('   - Async storage is taking longer than expected');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

console.log(`
╔════════════════════════════════════════════════════════╗
║        ANALYTICS STORAGE TEST                          ║
╚════════════════════════════════════════════════════════╝
`);

testAnalyticsStorage()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
