require('dotenv').config();
const mongoose = require('mongoose');

async function verifyCollections() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Connected to MongoDB Atlas\n');
    console.log('📊 Database:', mongoose.connection.name);
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('\n📚 Collections created:');
    console.log('─'.repeat(50));
    
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      const indexes = await mongoose.connection.db.collection(collection.name).indexes();
      console.log(`\n✓ ${collection.name}`);
      console.log(`  Documents: ${count}`);
      console.log(`  Indexes: ${indexes.length}`);
      indexes.forEach(idx => {
        const keys = Object.keys(idx.key).join(', ');
        console.log(`    - ${idx.name} (${keys})`);
      });
    }
    
    console.log('\n' + '─'.repeat(50));
    console.log(`\n✅ Total collections: ${collections.length}`);
    
    console.log('\n⚠️  IMPORTANT: Remember to create the vector search index!');
    console.log('   Go to MongoDB Atlas → Browse Collections → knowledgebases');
    console.log('   → Search Indexes tab → Create Search Index');
    console.log('   See SETUP_CHECKLIST.md Step 7 for details\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyCollections();
